package app

import (
	"strings"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
)

// ControlWindowsService 对指定 Windows 服务执行控制动作（start/stop/restart），
// 供首页服务总览的行内操作按钮调用。restart 先等停止完成再启动。
func (a *App) ControlWindowsService(name string, action string) connection.QueryResult {
	name = strings.TrimSpace(name)
	if name == "" {
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.name_required", nil)}
	}
	switch action {
	case "start", "stop", "restart":
	default:
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.action_invalid", map[string]any{"action": action})}
	}
	if err := controlServiceEntry(name, action); err != nil {
		logger.Error(err, "控制 Windows 服务失败: %s %s", name, action)
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.control_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"name": name, "action": action}}
}
