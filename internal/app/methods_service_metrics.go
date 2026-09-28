package app

import (
	"strings"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
)

// serviceMetricSample 是单个纳管服务的运行时指标。CPUTotal 是进程启动以来的累计 CPU 秒，
// 前端用相邻两次采样的差值换算百分比（与首页主机 CPU 的算法一致）。
type serviceMetricSample struct {
	Name     string  `json:"name"`
	State    string  `json:"state"`
	PID      uint32  `json:"pid"`
	CPUTotal float64 `json:"cpuTotal"`
	MemBytes uint64  `json:"memBytes"`
}

// SampleServiceMetrics 采样指定服务的状态与进程级指标（每 2 秒由首页轮询）。
// 只接受纳管服务名，避免全量枚举 SCM 的开销。
func (a *App) SampleServiceMetrics(names []string) connection.QueryResult {
	cleaned := make([]string, 0, len(names))
	seen := make(map[string]struct{}, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, dup := seen[name]; dup {
			continue
		}
		seen[name] = struct{}{}
		cleaned = append(cleaned, name)
	}
	if len(cleaned) == 0 {
		return connection.QueryResult{Success: true, Data: map[string]any{"services": []serviceMetricSample{}}}
	}
	samples, err := sampleServiceMetrics(cleaned)
	if err != nil {
		logger.Error(err, "采样服务指标失败")
		return connection.QueryResult{Success: false, Message: a.appText("home.backend.error.metrics_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"services": samples}}
}
