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

// servyVersionProbeTimeout 是 --version 探测的上限；引擎文件损坏时不能卡住设置页。
const servyVersionProbeTimeout = 5 * time.Second

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

// locateServyEngine 按固定顺序查找 servy 引擎：
// 环境变量 SERVDECK_SERVY_PATH → 设置中配置的引擎路径（bootstrap 配置）→ 可执行文件同目录 → 常见工具目录 → PATH。
// 不依赖固定文件名（新版本可能改名）：目录内按 servy*.exe 通配发现候选，
// 每个候选都用 --version 输出验证确实是 Servy CLI 后才采用。
func locateServyEngine() (string, error) {
	if custom := strings.TrimSpace(os.Getenv("SERVDECK_SERVY_PATH")); custom != "" {
		if serviceFileExists(custom) {
			return custom, nil
		}
	}
	if configured := appdata.ResolveServyEngineOverride(); configured != "" {
		if serviceFileExists(configured) {
			return configured, nil
		}
	}
	if exePath, err := os.Executable(); err == nil {
		if found := findServyEngineInDir(filepath.Dir(exePath)); found != "" {
			return found, nil
		}
	}
	for _, dir := range []string{"C:\\workspace\\assets", "C:\\tools\\servy"} {
		if found := findServyEngineInDir(dir); found != "" {
			return found, nil
		}
	}
	for _, dir := range filepath.SplitList(os.Getenv("PATH")) {
		if found := findServyEngineInDir(dir); found != "" {
			return found, nil
		}
	}
	return "", errors.New("servy engine not found (set SERVDECK_SERVY_PATH)")
}

// findServyEngineInDir 在单个目录里按 servy*.exe 通配找引擎候选，
// 逐个跑 --version 验证，返回第一个能确认是 Servy CLI 的路径。
func findServyEngineInDir(dir string) string {
	matches, err := filepath.Glob(filepath.Join(dir, "servy*.exe"))
	if err != nil {
		return ""
	}
	for _, candidate := range matches {
		if isServyCLI(candidate) {
			return candidate
		}
	}
	return ""
}

// isServyCLI 运行 --version 判断可执行文件是不是 Servy CLI（改名后的引擎靠它识别）。
func isServyCLI(path string) bool {
	return servyEngineVersion(path) != ""
}

// servyEngineVersion 运行引擎的 --version 并解析版本号（如 10.1.0）；
// 执行失败或输出不是 Servy.CLI 格式时返回空串。
func servyEngineVersion(path string) string {
	ctx, cancel := context.WithTimeout(context.Background(), servyVersionProbeTimeout)
	defer cancel()
	cmd := servyCommandContext(ctx, path, "--version")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return parseServyVersionOutput(string(output))
}

// parseServyVersionOutput 解析 servy 引擎 --version 的输出，形如
// "Servy.CLI 10.1.0+976276e089e81fdd729dfdd81c7b8265eb459c73"，返回 10.1.0。
func parseServyVersionOutput(output string) string {
	fields := strings.Fields(strings.TrimSpace(output))
	if len(fields) < 2 || fields[0] != "Servy.CLI" {
		return ""
	}
	version := fields[1]
	if plus := strings.Index(version, "+"); plus > 0 {
		version = version[:plus]
	}
	// 语义化版本以数字开头（如 10.1.0）；"+abc" 这类输出不是版本号。
	if version == "" || version[0] < '0' || version[0] > '9' {
		return ""
	}
	return version
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
	if request.Rotate {
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
