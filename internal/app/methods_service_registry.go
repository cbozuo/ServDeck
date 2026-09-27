package app

import (
	"strings"

	"GoNavi-Wails/internal/connection"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"GoNavi-Wails/internal/logger"
)

// AddServiceRequest 是前端「添加服务」弹框提交的请求体。
// Mode 决定加入方式：register = 注册新服务（servy install + start）；
// manage = 纳管已存在的服务（不执行注册，仅记录管理）。
type AddServiceRequest struct {
	Mode        string `json:"mode"`
	ServiceType string `json:"serviceType"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
	ProgramFile string `json:"programFile"`
	Params      string `json:"params"`
	WorkDir     string `json:"workDir"`
	StartType   string `json:"startType"`
	Restart     bool   `json:"restart"`
	ConfName    string `json:"confName"`
	ConfContent string `json:"confContent"`
}

const (
	addServiceModeRegister = "register"
	addServiceModeManage   = "manage"
)

// ProbeWindowsService 探测指定名称的 Windows 服务是否已存在（含状态与启动类型），
// 并顺带校验程序文件是否存在。前端在「加入纳管」前调用，用于服务名唯一性检查。
func (a *App) ProbeWindowsService(name string, programFile string) connection.QueryResult {
	name = strings.TrimSpace(name)
	if name == "" {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.name_required", nil)}
	}
	result, err := probeServiceEntry(name, strings.TrimSpace(programFile))
	if err != nil {
		logger.Error(err, "探测 Windows 服务失败")
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.probe_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: result}
}

// AddManagedService 把一个服务加入纳管：
//   - register 模式：写入配置文件（如缺失）并通过 servy 注册 + 启动；
//   - manage 模式：服务已存在，仅返回纳管确认，不改动该服务的任何配置。
func (a *App) AddManagedService(request AddServiceRequest) connection.QueryResult {
	request.Name = strings.TrimSpace(request.Name)
	if request.Name == "" {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.name_required", nil)}
	}
	if request.Mode != addServiceModeManage && strings.TrimSpace(request.ProgramFile) == "" {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.program_required", nil)}
	}
	if request.Mode == addServiceModeManage {
		return connection.QueryResult{Success: true, Data: map[string]any{
			"managed":    true,
			"registered": false,
			"name":       request.Name,
		}}
	}

	result, err := registerServiceWithServy(request)
	if err != nil {
		logger.Error(err, "注册 Windows 服务失败")
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.register_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: result}
}

// LocateServyEngine 返回 servy-10.1.exe 的解析路径，供前端展示引擎状态。
func (a *App) LocateServyEngine() connection.QueryResult {
	path, err := locateServyEngine()
	if err != nil {
		return connection.QueryResult{Success: true, Data: map[string]any{"available": false, "reason": err.Error()}}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"available": true, "path": path}}
}

// SelectServiceProgramFile 打开系统文件选择器，返回用户选中的程序文件路径（取消时为空串）。
func (a *App) SelectServiceProgramFile(serviceType string) connection.QueryResult {
	if a.webRuntime {
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.log_directory.backend.error.desktop_only", nil)}
	}
	filters := []wailsruntime.FileFilter{
		{DisplayName: a.appText("file.backend.filter.all_files_pattern", nil), Pattern: "*.*"},
	}
	if strings.EqualFold(serviceType, "java") {
		filters = []wailsruntime.FileFilter{
			{DisplayName: "Java (JAR/WAR)", Pattern: "*.jar;*.war"},
			{DisplayName: a.appText("file.backend.filter.all_files_pattern", nil), Pattern: "*.*"},
		}
	}
	selection, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:   a.appText("service.modal.program.heading", nil),
		Filters: filters,
	})
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"path": selection}}
}
