package app

import (
	"strings"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
)

// GetWindowsServiceDetail 返回单个 Windows 服务的完整详情（SCM 配置 + 进程信息），
// 供服务详情页 Hero 与部署页渲染。
func (a *App) GetWindowsServiceDetail(name string) connection.QueryResult {
	if name == "" {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.name_required", nil)}
	}
	detail, err := buildServiceDetailSnapshot(name)
	if err != nil {
		logger.Error(err, "读取服务详情失败: %s", name)
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.metrics_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: detail}
}

// SampleServiceDetailMetrics 采样单个服务的实时指标（详情页 2 秒轮询）。
func (a *App) SampleServiceDetailMetrics(name string) connection.QueryResult {
	trimmed := name
	if trimmed == "" {
		return connection.QueryResult{Success: true, Data: map[string]any{"sample": nil}}
	}
	sample := sampleServiceDetailMetrics(trimmed)
	return connection.QueryResult{Success: true, Data: map[string]any{"sample": sample}}
}

// ListServiceLogFiles 列出服务日志目录下的日志文件（名/大小/修改时间）。
func (a *App) ListServiceLogFiles(name string) connection.QueryResult {
	files, err := listServiceLogFiles(name)
	if err != nil {
		return connection.QueryResult{Success: true, Data: map[string]any{"files": []serviceLogFile{}, "error": err.Error()}}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"files": files}}
}

// ReadServiceLogTail 读取指定服务日志文件的尾部（默认 400 行，倒序返回由前端处理）。
func (a *App) ReadServiceLogTail(name string, file string, lineLimit int) connection.QueryResult {
	if lineLimit <= 0 || lineLimit > 5000 {
		lineLimit = 400
	}
	content, err := readServiceLogFileTail(name, file, lineLimit)
	if err != nil {
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.metrics_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"content": content}}
}

// GetServiceDirUsage 计算服务程序文件所在目录的占用（字节）。
func (a *App) GetServiceDirUsage(name string, programFile string) connection.QueryResult {
	used, err := serviceDirUsage(name, programFile)
	if err != nil {
		return connection.QueryResult{Success: true, Data: map[string]any{"bytes": 0, "error": err.Error()}}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"bytes": used}}
}

// CheckServicePorts 检测一组 TCP 端口的监听状态（服务自身或依赖服务）。
func (a *App) CheckServicePorts(ports []int) connection.QueryResult {
	listening := listeningTCPPorts()
	results := make([]map[string]any, 0, len(ports))
	seen := map[int]bool{}
	okCount := 0
	for _, port := range ports {
		if port <= 0 || port > 65535 || seen[port] {
			continue
		}
		seen[port] = true
		ok := listening[port]
		if ok {
			okCount++
		}
		results = append(results, map[string]any{"port": port, "listening": ok})
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"ports": results, "okCount": okCount, "total": len(results)}}
}

// UninstallServyService 通过 servy-cli 卸载服务（停止并移除 SCM 注册，文件保留）。
func (a *App) UninstallServyService(name string) connection.QueryResult {
	trimmed := name
	if trimmed == "" {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.name_required", nil)}
	}
	if err := uninstallServyService(trimmed); err != nil {
		logger.Error(err, "卸载服务失败: %s", trimmed)
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.control_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"name": trimmed}}
}

// OpenServiceLogDirectory 在系统文件管理器中打开服务日志目录（不存在时先创建）。
func (a *App) OpenServiceLogDirectory(name string) connection.QueryResult {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.name_required", nil)}
	}
	if err := openServiceLogDirectory(trimmed); err != nil {
		logger.Error(err, "打开服务日志目录失败: %s", trimmed)
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.log_directory.backend.error.open_directory_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"name": trimmed}}
}

// ListServiceEngineEvents 返回 servy 引擎日志里该服务的事件（引擎写盘的真实时刻，倒序）。
func (a *App) ListServiceEngineEvents(name string) connection.QueryResult {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return connection.QueryResult{Success: true, Data: map[string]any{"events": []serviceEngineEvent{}}}
	}
	events := readServyEngineEvents(trimmed, 200)
	return connection.QueryResult{Success: true, Data: map[string]any{"events": events}}
}

// SaveServiceConf 保存服务的配置文件内容（写前自动备份为 <名>.bak，保存后需重启生效）。
func (a *App) SaveServiceConf(name string, file string, content string) connection.QueryResult {
	if file == "" || strings.ContainsAny(file, `/\`) || strings.Contains(file, "..") {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.name_required", nil)}
	}
	if err := saveServiceConfFile(name, file, content); err != nil {
		logger.Error(err, "保存服务配置失败: %s %s", name, file)
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.control_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"saved": true}}
}
