package app

import (
	"os"
	"path/filepath"
	"strings"

	"GoNavi-Wails/internal/appdata"
	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
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
	// Restart 是崩溃守护（servy 对服务进程默认守护、异常退出自动拉起，无安装旗标）；
	// 字段保留在请求里供纳管记录与后续版本使用。
	Restart     bool   `json:"restart"`
	Rotate      bool   `json:"rotate"`
	ConfName    string `json:"confName"`
	ConfContent string `json:"confContent"`
}

const (
	addServiceModeRegister = "register"
	addServiceModeManage   = "manage"
)

// ProbeWindowsService 探测指定名称的 Windows 服务是否已存在（含状态与启动类型），
// 并顺带校验程序文件是否存在。前端在「加入纳管」前调用，用于服务名唯一性检查。
// 服务名为空时跳过 SCM 查询、仅校验程序文件：前端探测按「程序文件为空 → 不存在 →
// 服务名为空 → 重复 → 显示名称为空」的顺序反馈，文件校验必须先于服务名校验。
func (a *App) ProbeWindowsService(name string, programFile string) connection.QueryResult {
	name = strings.TrimSpace(name)
	programFile = strings.TrimSpace(programFile)
	if name == "" {
		return connection.QueryResult{Success: true, Data: serviceProbeResult{FileExists: serviceFileExists(programFile)}}
	}
	result, err := probeServiceEntry(name, programFile)
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

// LocateServyEngine 返回 servy 引擎的解析路径与版本号，供首页引擎卡展示。
func (a *App) LocateServyEngine() connection.QueryResult {
	path, err := locateServyEngine()
	if err != nil {
		return connection.QueryResult{Success: true, Data: map[string]any{"available": false, "reason": err.Error()}}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{
		"available": true,
		"path":      path,
		"version":   servyEngineVersion(path),
	}}
}

// GetServyEngineConfig 返回 servy 引擎的用户配置与当前解析结果，供设置页展示：
//   - configuredPath：用户在设置中配置的路径（空串表示未配置，走默认查找链）；
//   - path / available / reason：当前实际生效的引擎位置（locateServyEngine 的解析结果）；
//   - appDir：应用运行目录（ServDeck.exe 所在），引擎默认目录的派生源。
func (a *App) GetServyEngineConfig() connection.QueryResult {
	return connection.QueryResult{Success: true, Data: servyEngineConfigPayload()}
}

// ApplyServyEnginePath 保存设置中配置的 servy 引擎路径；传空串表示清除配置、恢复默认查找链。
// 保存后立即重新解析引擎位置，前端据此更新状态徽标与生效路径。
func (a *App) ApplyServyEnginePath(path string) connection.QueryResult {
	if err := appdata.SetServyEnginePath(path); err != nil {
		logger.Error(err, "保存 servy 引擎路径失败")
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	data := servyEngineConfigPayload()
	if available, _ := data["available"].(bool); available {
		return connection.QueryResult{Success: true, Data: data, Message: a.appText("app.engine.backend.message.applied", nil)}
	}
	return connection.QueryResult{Success: true, Data: data, Message: a.appText("app.engine.backend.message.applied_but_missing", nil)}
}

// servyEngineConfigPayload 聚合引擎配置信息（用户配置路径、当前解析路径、版本、可用性与应用运行目录）。
func servyEngineConfigPayload() map[string]any {
	data := map[string]any{
		"configuredPath": appdata.ResolveServyEngineOverride(),
	}
	if exePath, err := os.Executable(); err == nil {
		data["appDir"] = filepath.Dir(exePath)
	}
	engine, err := locateServyEngine()
	if err != nil {
		data["available"] = false
		data["reason"] = err.Error()
	} else {
		data["available"] = true
		data["path"] = engine
		data["version"] = servyEngineVersion(engine)
	}
	return data
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

// SelectServyEngineFile 打开系统文件选择器，让用户挑 servy-cli.exe。
// 只返回选中的路径，不做可用性校验——校验统一由「检测并应用」负责。
func (a *App) SelectServyEngineFile() connection.QueryResult {
	if a.webRuntime {
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.log_directory.backend.error.desktop_only", nil)}
	}
	selection, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: a.appText("app.engine.action.browse", nil),
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "servy-cli (servy-cli.exe)", Pattern: "*.exe"},
			{DisplayName: a.appText("file.backend.filter.all_files_pattern", nil), Pattern: "*.*"},
		},
	})
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"path": strings.TrimSpace(selection)}}
}
