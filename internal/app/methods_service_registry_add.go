package app

import (
	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
)

// ListWindowsServices 枚举本机 SCM 全部 Win32 服务（名称/显示名/状态/启动类型），
// 供首页合并纳管服务的实时状态、以及后续「扫描发现」使用。
func (a *App) ListWindowsServices() connection.QueryResult {
	if a.webRuntime {
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.log_directory.backend.error.desktop_only", nil)}
	}
	services, err := listServiceEntries()
	if err != nil {
		logger.Error(err, "枚举 Windows 服务失败")
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.probe_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: map[string]any{"services": services}}
}

// hostResourceSample 是一次本机资源快照。CPU 三个累计时间为系统启动以来的
// 总量，前端以两次轮询的差值计算占用百分比（后端无状态）。UptimeSeconds 为
// 开机秒数；Net*/Disk* 为 PDH 计数器给出的即时速率（字节/秒），不可用时为 0。
type hostResourceSample struct {
	CPU           map[string]uint64 `json:"cpu"`
	Memory        map[string]uint64 `json:"memory"`
	Disks         []hostDiskInfo    `json:"disks"`
	UptimeSeconds uint64            `json:"uptimeSeconds"`
	NetUpBps      float64           `json:"netUpBps"`
	NetDownBps    float64           `json:"netDownBps"`
	DiskReadBps   float64           `json:"diskReadBps"`
	DiskWriteBps  float64           `json:"diskWriteBps"`
}

type hostDiskInfo struct {
	Drive   string `json:"drive"`
	Total   uint64 `json:"total"`
	Free    uint64 `json:"free"`
	Used    uint64 `json:"used"`
	UsedPct int    `json:"usedPct"`
}

// SampleHostResources 采样本机资源：CPU 累计时间、物理内存、磁盘 C: 用量。
// 网络速率需要差值基线，后续版本接入。
func (a *App) SampleHostResources() connection.QueryResult {
	if a.webRuntime {
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.log_directory.backend.error.desktop_only", nil)}
	}
	sample, err := sampleHostResources()
	if err != nil {
		logger.Error(err, "采样本机资源失败")
		return connection.QueryResult{Success: false, Message: a.appText("service.registry.backend.error.probe_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Data: sample}
}
