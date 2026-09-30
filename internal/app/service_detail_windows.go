//go:build windows

package app

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

// serviceDetailSnapshot 是服务详情页的一次完整快照：SCM 状态 + 配置 + 进程信息。
// Installed=false 表示 SCM 中已无此服务（被卸载/注册失败清理），其余字段留空。
type serviceDetailSnapshot struct {
	Name             string   `json:"name"`
	Installed        bool     `json:"installed"`
	DisplayName      string   `json:"displayName"`
	Description      string   `json:"description"`
	State            string   `json:"state"`
	PID              uint32   `json:"pid"`
	StartType        string   `json:"startType"`
	DelayedAutoStart bool     `json:"delayedAutoStart"`
	BinaryPathName   string   `json:"binaryPathName"`
	Account          string   `json:"account"`
	Dependencies     []string `json:"dependencies"`
	StartedAt        int64    `json:"startedAt"`
	UptimeSeconds    uint64   `json:"uptimeSeconds"`
	ProgramFile      string   `json:"programFile"`
	LogDir           string   `json:"logDir"`
}

// buildServiceDetailSnapshot 查询 SCM 状态与配置，并从进程创建时间推算启动时刻。
// 服务不存在不算错误：返回 Installed=false 的快照，供前端渲染「未注册」形态。
func buildServiceDetailSnapshot(name string) (*serviceDetailSnapshot, error) {
	m, err := mgr.Connect()
	if err != nil {
		return nil, fmt.Errorf("connect SCM: %w", err)
	}
	defer m.Disconnect()

	detail := &serviceDetailSnapshot{Name: name, Installed: true, LogDir: servicesLogDirOrEmpty(name)}
	service, err := m.OpenService(name)
	if err != nil {
		// ERROR_SERVICE_DOES_NOT_EXIST：服务已被卸载，返回未注册快照而非失败
		detail.Installed = false
		return detail, nil
	}
	defer service.Close()
	status, err := service.Query()
	if err != nil {
		return nil, fmt.Errorf("query service %s: %w", name, err)
	}
	detail.State = serviceStateString(status.State)
	detail.PID = status.ProcessId

	config, err := service.Config()
	if err == nil {
		detail.DisplayName = config.DisplayName
		detail.Description = config.Description
		detail.StartType = serviceStartTypeString(config.StartType)
		detail.DelayedAutoStart = config.DelayedAutoStart
		detail.BinaryPathName = config.BinaryPathName
		detail.Account = config.ServiceStartName
		detail.Dependencies = config.Dependencies
	}

	if status.State == svc.Running && status.ProcessId != 0 {
		creationUnix, uptime := processCreationInfo(status.ProcessId)
		detail.StartedAt = creationUnix
		detail.UptimeSeconds = uptime
		if exe := processImageName(status.ProcessId); exe != "" {
			detail.ProgramFile = exe
		}
	}
	if detail.ProgramFile == "" {
		detail.ProgramFile = programFileFromBinaryPath(detail.BinaryPathName, name)
	}
	return detail, nil
}

// processCreationInfo 返回进程创建时刻（epoch 秒）与已运行秒数。
func processCreationInfo(pid uint32) (int64, uint64) {
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return 0, 0
	}
	defer windows.CloseHandle(handle)
	var creation, exit, kernel, user windows.Filetime
	if err := windows.GetProcessTimes(handle, &creation, &exit, &kernel, &user); err != nil {
		return 0, 0
	}
	created := creation.Nanoseconds() / 1e9
	now := time.Now().Unix()
	uptime := uint64(0)
	if now > created {
		uptime = uint64(now - created)
	}
	return created, uptime
}

// processImageName 通过 QueryFullProcessImageNameW 取进程 exe 路径。
func processImageName(pid uint32) string {
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return ""
	}
	defer windows.CloseHandle(handle)
	buf := make([]uint16, 1024)
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(handle, 0, &buf[0], &size); err != nil {
		return ""
	}
	return windows.UTF16ToString(buf[:size])
}

// programFileFromBinaryPath 从 SCM binPath 中剥离参数得到程序路径；
// servy 包装场景（servy-cli.exe -p <目标> ...）取 -p 的值。
func programFileFromBinaryPath(binPath string, name string) string {
	parts := splitCommandline(binPath)
	for i, part := range parts {
		if strings.EqualFold(part, "-p") || strings.EqualFold(part, "--path") {
			if i+1 < len(parts) {
				return parts[i+1]
			}
		}
	}
	for _, part := range parts {
		if strings.Contains(strings.ToLower(part), strings.ToLower(name)) {
			return part
		}
	}
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}

// splitCommandline 按带引号的规则切分命令行（沿用 Windows 引号语义的简化版）。
func splitCommandline(line string) []string {
	var parts []string
	var cur strings.Builder
	inQuote := false
	for _, r := range line {
		switch {
		case r == '"':
			inQuote = !inQuote
		case r == ' ' && !inQuote:
			if cur.Len() > 0 {
				parts = append(parts, cur.String())
				cur.Reset()
			}
		default:
			cur.WriteRune(r)
		}
	}
	if cur.Len() > 0 {
		parts = append(parts, cur.String())
	}
	return parts
}

func servicesLogDirOrEmpty(name string) string {
	dir, err := servicesLogDir(name)
	if err != nil {
		return ""
	}
	return dir
}

// ── 日志文件列表与尾部读取 ────────────────────────────────

// serviceLogFile 是日志目录里的一个日志文件。
type serviceLogFile struct {
	Name       string `json:"name"`
	SizeBytes  int64  `json:"sizeBytes"`
	ModifiedAt int64  `json:"modifiedAt"`
	Kind       string `json:"kind"`
}

func listServiceLogFiles(name string) ([]serviceLogFile, error) {
	dir, err := servicesLogDir(name)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read log dir: %w", err)
	}
	files := make([]serviceLogFile, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".log") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		kind := "out"
		lower := strings.ToLower(entry.Name())
		switch {
		case strings.Contains(lower, "err"):
			kind = "err"
		case strings.Contains(lower, "rot"):
			kind = "rot"
		}
		files = append(files, serviceLogFile{
			Name:       entry.Name(),
			SizeBytes:  info.Size(),
			ModifiedAt: info.ModTime().Unix(),
			Kind:       kind,
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].ModifiedAt > files[j].ModifiedAt })
	return files, nil
}

func readServiceLogFileTail(name string, file string, lineLimit int) (string, error) {
	if file == "" || strings.ContainsAny(file, `/\`) || strings.Contains(file, "..") {
		return "", fmt.Errorf("invalid log file name")
	}
	dir, err := servicesLogDir(name)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(dir, file))
	if err != nil {
		return "", fmt.Errorf("read log file: %w", err)
	}
	lines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	if len(lines) > lineLimit {
		lines = lines[len(lines)-lineLimit:]
	}
	return strings.Join(lines, "\n"), nil
}

// ── 目录占用 ────────────────────────────────

// serviceDirUsage 计算程序文件所在目录的总占用（字节）；目录不存在返回 0。
func serviceDirUsage(name string, programFile string) (uint64, error) {
	dir := ""
	if programFile != "" {
		dir = filepath.Dir(programFile)
	} else {
		dir = servicesLogDirOrEmpty(name)
	}
	if dir == "" {
		return 0, nil
	}
	var total uint64
	err := filepath.WalkDir(dir, func(_ string, entry os.DirEntry, err error) error {
		if err != nil {
			return nil // 无权限/已删除的子项跳过，不中断统计
		}
		if entry.IsDir() {
			return nil
		}
		if info, infoErr := entry.Info(); infoErr == nil {
			total += uint64(info.Size())
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return total, nil
}

// ── 依赖端口检测 ────────────────────────────────

// listeningTCPPorts 返回当前处于 LISTEN 状态的 TCP 端口集合。
// TCP_TABLE_OWNER_PID_LISTENER=3，行结构与 owner-pid 表一致（localPort 在偏移 0）。
func listeningTCPPorts() map[int]bool {
	ports := map[int]bool{}
	buf := make([]byte, 64*1024)
	size := uint32(len(buf))
	ret, _, _ := procGetExtendedTcpTable.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
		0,
		windows.AF_INET,
		3, // TCP_TABLE_OWNER_PID_LISTENER
		0,
	)
	if ret != 0 || size < 4 {
		return ports
	}
	count := *(*uint32)(unsafe.Pointer(&buf[0]))
	const rowSize = tcp4RowSize
	for i := uint32(0); i < count; i++ {
		base := uintptr(4) + uintptr(i)*uintptr(rowSize)
		if base+2 > uintptr(size) {
			break
		}
		localPort := uint16(buf[base]) | uint16(buf[base+1])<<8
		ports[int(localPort)] = true
	}
	return ports
}

// extractConfiguredPorts 从 JVM/应用参数里解析常见端口配置。
func extractConfiguredPorts(params string) []int {
	var ports []int
	seen := map[int]bool{}
	for _, prefix := range []string{"-Dserver.port=", "-Dport=", "--server.port=", "--port=", "--address=*:", "address=*:"} {
		for _, segment := range strings.Split(params, " ") {
			if idx := strings.Index(segment, prefix); idx >= 0 {
				rest := segment[idx+len(prefix):]
				end := strings.IndexAny(rest, " ,;")
				if end >= 0 {
					rest = rest[:end]
				}
				port := 0
				for _, r := range rest {
					if r < '0' || r > '9' {
						break
					}
					port = port*10 + int(r-'0')
				}
				if port > 0 && port <= 65535 && !seen[port] {
					seen[port] = true
					ports = append(ports, port)
				}
			}
		}
	}
	return ports
}

// ── servy 引擎事件日志 ─────────────────────────

// serviceEngineEvent 是 servy 引擎日志里属于某服务的一条事件（时间为引擎写盘的真实时刻）。
type serviceEngineEvent struct {
	At    int64  `json:"at"`    // epoch 秒
	Level string `json:"level"` // INFO / WARN / ERROR
	Text  string `json:"text"`
}

// servyEngineLogFiles 引擎侧两份事件日志：服务宿主事件 + CLI 操作记录。
var servyEngineLogFiles = []string{
	`C:\ProgramData\Servy\logs\Servy.Service.log`,
	`C:\ProgramData\Servy\logs\Servy.CLI.log`,
}

// readServyEngineEvents 读引擎日志、按服务名过滤（[名] 或 '名'），倒序返回最近 limit 条。
// 行格式：[2026-09-29 10:34:57.035Z] [INFO] | 消息（时间恒为 UTC 带 Z）。
func readServyEngineEvents(name string, limit int) []serviceEngineEvent {
	events := make([]serviceEngineEvent, 0, limit)
	if name == "" {
		return events
	}
	needle := "[" + name + "'"
	for _, path := range servyEngineLogFiles {
		data, err := readLogFileTailBytes(path, 512*1024)
		if err != nil {
			continue // 文件不存在/无权限：跳过该来源
		}
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimRight(line, "\r")
			event, ok := parseServyEngineLine(line)
			if !ok {
				continue
			}
			if !strings.Contains(event.Text, "["+name+"]") && !strings.Contains(event.Text, needle) {
				continue
			}
			events = append(events, event)
		}
	}
	// 倒序（最新在前）并截尾
	for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
		events[i], events[j] = events[j], events[i]
	}
	if len(events) > limit {
		events = events[:limit]
	}
	return events
}

// readLogFileTailBytes 读文件末尾 maxBytes（大日志避免整读）。
func readLogFileTailBytes(path string, maxBytes int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}
	offset := int64(0)
	if stat.Size() > maxBytes {
		offset = stat.Size() - maxBytes
	}
	if _, err := file.Seek(offset, 0); err != nil {
		return nil, err
	}
	buf := make([]byte, stat.Size()-offset)
	if _, err := file.Read(buf); err != nil && len(buf) == 0 {
		return nil, err
	}
	// 从中间截断时丢弃首个残行
	if offset > 0 {
		if idx := bytes.IndexByte(buf, '\n'); idx >= 0 {
			buf = buf[idx+1:]
		}
	}
	return buf, nil
}

// parseServyEngineLine 解析引擎日志行：[时间] [级别] | 消息。
func parseServyEngineLine(line string) (serviceEngineEvent, bool) {
	if !strings.HasPrefix(line, "[") {
		return serviceEngineEvent{}, false
	}
	tsEnd := strings.Index(line, "] ")
	if tsEnd < 0 {
		return serviceEngineEvent{}, false
	}
	at, err := time.Parse("2006-01-02 15:04:05.000Z", line[1:tsEnd])
	if err != nil {
		return serviceEngineEvent{}, false
	}
	rest := line[tsEnd+2:]
	lvEnd := strings.Index(rest, "] ")
	if lvEnd < 0 {
		return serviceEngineEvent{}, false
	}
	message := strings.TrimPrefix(rest[lvEnd+2:], "| ")
	return serviceEngineEvent{
		At:    at.Unix(),
		Level: strings.ToUpper(rest[:lvEnd]),
		Text:  strings.TrimSpace(message),
	}, true
}

// UninstallServyService 通过 servy-cli 卸载服务。
func uninstallServyService(name string) error {
	engine, err := locateServyEngine()
	if err != nil {
		return err
	}
	_, err = runServyCommand(engine, []string{"uninstall", "--name", name}, "")
	return err
}

// openServiceLogDirectory 在系统文件管理器中打开服务日志目录；目录不存在时先创建。
func openServiceLogDirectory(name string) error {
	// 服务名直接参与路径拼接，拒绝路径分隔符与相对段（与 readServiceLogFileTail 同一谨慎口径）
	if name == "" || strings.ContainsAny(name, `/\`) || strings.Contains(name, "..") {
		return fmt.Errorf("invalid service name")
	}
	dir, err := servicesLogDir(name)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create log dir: %w", err)
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", dir)
	case "windows":
		cmd = exec.Command("explorer", dir)
	case "linux":
		cmd = exec.Command("xdg-open", dir)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("launch file manager: %w", err)
	}
	return nil
}

// saveServiceConfFile 保存配置文件内容；已存在时先备份为 <名>.bak。
func saveServiceConfFile(name string, file string, content string) error {
	dir, err := servicesLogDir(name)
	if err != nil {
		return err
	}
	// conf 与日志同目录约定（注册时 conf 写在工作目录，备份读取以 logDir 下同名优先）
	target := filepath.Join(dir, file)
	if _, err := os.Stat(target); err == nil {
		if err := os.WriteFile(target+".bak", mustRead(target), 0o644); err != nil {
			return fmt.Errorf("backup conf: %w", err)
		}
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return fmt.Errorf("create conf dir: %w", err)
	}
	return os.WriteFile(target, []byte(content), 0o644)
}

func mustRead(path string) []byte {
	data, err := os.ReadFile(path)
	if err != nil {
		return []byte{}
	}
	return data
}
