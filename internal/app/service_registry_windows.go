//go:build windows

package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"

	"GoNavi-Wails/internal/appdata"
)

const servyCommandTimeout = 60 * time.Second

// servyCommandContext 是 exec.CommandContext 的接缝，便于测试替换。
var servyCommandContext = exec.CommandContext

type serviceProbeResult struct {
	Exists     bool   `json:"exists"`
	State      string `json:"state,omitempty"`
	StartType  string `json:"startType,omitempty"`
	FileExists bool   `json:"fileExists"`
}

type serviceAddResult struct {
	Managed    bool   `json:"managed"`
	Registered bool   `json:"registered"`
	Name       string `json:"name"`
	LogDir     string `json:"logDir,omitempty"`
	Output     string `json:"output,omitempty"`
}

func probeServiceEntry(name string, programFile string) (serviceProbeResult, error) {
	result := serviceProbeResult{FileExists: serviceFileExists(programFile)}
	state, startType, exists, err := queryWindowsService(name)
	if err != nil {
		return serviceProbeResult{}, err
	}
	if exists {
		result.Exists = true
		result.State = state
		result.StartType = startType
	}
	return result, nil
}

// queryWindowsService 通过 SCM 查询服务的存在性、运行状态与启动类型。
func queryWindowsService(name string) (state string, startType string, exists bool, err error) {
	m, err := mgr.Connect()
	if err != nil {
		return "", "", false, fmt.Errorf("connect SCM: %w", err)
	}
	defer m.Disconnect()

	service, err := m.OpenService(name)
	if err != nil {
		if errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
			return "", "", false, nil
		}
		return "", "", false, fmt.Errorf("open service %s: %w", name, err)
	}
	defer service.Close()

	status, err := service.Query()
	if err != nil {
		return "", "", true, fmt.Errorf("query service %s: %w", name, err)
	}
	state = serviceStateString(status.State)
	config, err := service.Config()
	if err != nil {
		return state, "", true, nil
	}
	return state, serviceStartTypeString(config.StartType), true, nil
}

func serviceStateString(state svc.State) string {
	switch state {
	case svc.Stopped:
		return "Stopped"
	case svc.StartPending:
		return "StartPending"
	case svc.StopPending:
		return "StopPending"
	case svc.Running:
		return "Running"
	case svc.ContinuePending:
		return "ContinuePending"
	case svc.PausePending:
		return "PausePending"
	case svc.Paused:
		return "Paused"
	default:
		return "Unknown"
	}
}

func serviceStartTypeString(startType uint32) string {
	switch startType {
	case windows.SERVICE_AUTO_START:
		return "Automatic"
	case windows.SERVICE_DEMAND_START:
		return "Manual"
	case windows.SERVICE_DISABLED:
		return "Disabled"
	default:
		return "Unknown"
	}
}

func serviceFileExists(path string) bool {
	path = strings.TrimSpace(path)
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// locateServyEngine 按固定顺序查找 servy-10.1.exe：
// 环境变量 SERVDECK_SERVY_PATH → 可执行文件同目录 → 常见工具目录 → PATH。
func locateServyEngine() (string, error) {
	const engineName = "servy-10.1.exe"
	if custom := strings.TrimSpace(os.Getenv("SERVDECK_SERVY_PATH")); custom != "" {
		if serviceFileExists(custom) {
			return custom, nil
		}
	}
	if exePath, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exePath), engineName)
		if serviceFileExists(candidate) {
			return candidate, nil
		}
	}
	for _, dir := range []string{"C:\\workspace\\assets", "C:\\tools\\servy"} {
		candidate := filepath.Join(dir, engineName)
		if serviceFileExists(candidate) {
			return candidate, nil
		}
	}
	if path, err := exec.LookPath(engineName); err == nil {
		return path, nil
	}
	return "", errors.New("servy engine not found (set SERVDECK_SERVY_PATH)")
}

func servicesLogDir(name string) (string, error) {
	root, err := appdata.ResolveActiveRoot()
	if err != nil {
		return "", fmt.Errorf("resolve app data root: %w", err)
	}
	return filepath.Join(root, "services", name, "logs"), nil
}

func registerServiceWithServy(request AddServiceRequest) (serviceAddResult, error) {
	engine, err := locateServyEngine()
	if err != nil {
		return serviceAddResult{}, err
	}
	logDir, err := servicesLogDir(request.Name)
	if err != nil {
		return serviceAddResult{}, err
	}
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return serviceAddResult{}, fmt.Errorf("create log dir: %w", err)
	}
	if err := writeServiceConfIfMissing(request, logDir); err != nil {
		return serviceAddResult{}, err
	}

	if _, err := runServyCommand(engine, buildServyInstallArgs(request, logDir), request.Params); err != nil {
		return serviceAddResult{}, err
	}
	if _, err := runServyCommand(engine, []string{"start", "--name", request.Name}, ""); err != nil {
		return serviceAddResult{}, err
	}
	return serviceAddResult{Managed: true, Registered: true, Name: request.Name, LogDir: logDir}, nil
}

func buildServyInstallArgs(request AddServiceRequest, logDir string) []string {
	args := []string{
		"install",
		"--name", request.Name,
		"-p", request.ProgramFile,
		"--displayName", request.DisplayName,
		"--startupDir", request.WorkDir,
		"--startupType", request.StartType,
		"--stdout", filepath.Join(logDir, "service-out.log"),
		"--stderr", filepath.Join(logDir, "service-err.log"),
	}
	if strings.TrimSpace(request.Description) != "" {
		args = append(args, "--description", request.Description)
	}
	if strings.TrimSpace(request.Params) != "" {
		args = append(args, "--params", request.Params)
	}
	if request.Restart {
		args = append(args, "--enableSizeRotation")
	}
	return args
}

// writeServiceConfIfMissing 把模板生成的配置文件写到工作目录；已存在则沿用不动。
func writeServiceConfIfMissing(request AddServiceRequest, logDir string) error {
	if strings.TrimSpace(request.ConfName) == "" || strings.TrimSpace(request.ConfContent) == "" {
		return nil
	}
	confPath := request.ConfName
	if !filepath.IsAbs(confPath) {
		workDir := strings.TrimSpace(request.WorkDir)
		if workDir == "" {
			workDir = filepath.Dir(request.ProgramFile)
		}
		confPath = filepath.Join(workDir, request.ConfName)
	}
	if serviceFileExists(confPath) {
		return nil
	}
	content := strings.ReplaceAll(request.ConfContent, "{{LOG_DIR}}", logDir)
	if err := os.MkdirAll(filepath.Dir(confPath), 0o755); err != nil {
		return fmt.Errorf("create conf dir: %w", err)
	}
	if err := os.WriteFile(confPath, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write conf: %w", err)
	}
	return nil
}

func runServyCommand(engine string, args []string, processParams string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), servyCommandTimeout)
	defer cancel()
	cmd := servyCommandContext(ctx, engine, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	if strings.TrimSpace(processParams) != "" {
		cmd.Env = append(os.Environ(), "SERVY_PROCESS_PARAMETERS="+processParams)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("%w; output: %s", err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}
