package app

import (
	"time"

	"GoNavi-Wails/internal/appdata"
	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
)

// GetServiceLogRetentionDays 返回服务日志保留天数（-1 = 永久保留）。
func (a *App) GetServiceLogRetentionDays() connection.QueryResult {
	return connection.QueryResult{Success: true, Data: map[string]any{"days": appdata.ResolveLogRetentionDays()}}
}

// SetServiceLogRetentionDays 保存保留天数（-1 = 永久；1..365 = 天数），
// 保存后立即执行一次过期清理并把删除数量带回给设置页反馈。
func (a *App) SetServiceLogRetentionDays(days int) connection.QueryResult {
	if days != -1 && (days < 1 || days > 365) {
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.log_retention.invalid", nil)}
	}
	if err := appdata.SetLogRetentionDays(days); err != nil {
		logger.Error(err, "保存日志保留天数失败: %d", days)
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.control_failed", map[string]any{"detail": err.Error()})}
	}
	effective := appdata.ResolveLogRetentionDays()
	removed, err := appdata.CleanExpiredServiceLogs(effective)
	if err != nil {
		logger.Warnf("日志保留清理执行失败：保留=%d天 err=%v", effective, err)
		removed = 0
	}
	logger.Infof("日志保留已设置：%d 天，本次清理 %d 个过期文件", days, removed)
	return connection.QueryResult{Success: true, Data: map[string]any{"days": effective, "removed": removed}}
}

// StartServiceLogRetentionScheduler 启动日志保留清理调度：
// 启动后半分钟清一次（错过昨日调度的补扫），之后每 24 小时一轮。非阻塞，由 OnStartup go 起。
func StartServiceLogRetentionScheduler() {
	time.Sleep(30 * time.Second)
	runServiceLogRetentionSweep()
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		runServiceLogRetentionSweep()
	}
}

func runServiceLogRetentionSweep() {
	days := appdata.ResolveLogRetentionDays()
	removed, err := appdata.CleanExpiredServiceLogs(days)
	if err != nil {
		logger.Warnf("日志保留清理执行失败：保留=%d天 err=%v", days, err)
		return
	}
	if removed > 0 {
		logger.Infof("日志保留清理（%d 天）：删除 %d 个过期日志文件", days, removed)
	}
}
