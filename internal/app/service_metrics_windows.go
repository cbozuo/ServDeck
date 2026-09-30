//go:build windows

package app

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc/mgr"
)

var procGetProcessMemoryInfo = windows.NewLazySystemDLL("psapi.dll").NewProc("GetProcessMemoryInfo")

// processMemoryCounters 对应 Win32 PROCESS_MEMORY_COUNTERS，只取工作集用到的字段。
type processMemoryCounters struct {
	Cb                         uint32
	PageFaultCount             uint32
	PeakWorkingSetSize         uintptr
	WorkingSetSize             uintptr
	QuotaPeakPagedPoolUsage    uintptr
	QuotaPagedPoolUsage        uintptr
	QuotaPeakNonPagedPoolUsage uintptr
	QuotaNonPagedPoolUsage     uintptr
	PagefileUsage              uintptr
	PeakPagefileUsage          uintptr
}

// sampleServiceMetrics 逐个查询服务状态并采样其宿主进程；服务打开失败（如刚被卸载）
// 时按 Unknown 上报而不是中断整批，保证列表行仍能渲染。
func sampleServiceMetrics(names []string) ([]serviceMetricSample, error) {
	m, err := mgr.Connect()
	if err != nil {
		return nil, fmt.Errorf("connect SCM: %w", err)
	}
	defer m.Disconnect()

	result := make([]serviceMetricSample, 0, len(names))
	for _, name := range names {
		sample := serviceMetricSample{Name: name, State: "Unknown"}
		service, err := m.OpenService(name)
		if err != nil {
			result = append(result, sample)
			continue
		}
		status, err := service.Query()
		if err == nil {
			sample.State = serviceStateString(status.State)
			// servy 包装注册时 SCM PID 是包装进程，切到工作负载子进程采样
			sample.PID = resolveWorkloadPID(status.ProcessId)
		}
		service.Close()
		if sample.PID != 0 {
			sample.CPUTotal, sample.MemBytes = sampleProcessMetrics(sample.PID)
		}
		result = append(result, sample)
	}
	return result, nil
}

// sampleProcessMetrics 取进程累计 CPU 时间与工作集内存；进程消失或权限不足时返回零值。
func sampleProcessMetrics(pid uint32) (cpuSeconds float64, memBytes uint64) {
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return 0, 0
	}
	defer windows.CloseHandle(handle)

	var creation, exit, kernel, user windows.Filetime
	if err := windows.GetProcessTimes(handle, &creation, &exit, &kernel, &user); err == nil {
		// kernel/user 是时长（100ns 单位），不能走带 1601 纪元减除的 Filetime.Nanoseconds()
		kernel100ns := int64(kernel.HighDateTime)<<32 | int64(kernel.LowDateTime)
		user100ns := int64(user.HighDateTime)<<32 | int64(user.LowDateTime)
		cpuSeconds = float64(kernel100ns+user100ns) / 1e7
	}
	var mem processMemoryCounters
	mem.Cb = uint32(unsafe.Sizeof(mem))
	r1, _, _ := procGetProcessMemoryInfo.Call(uintptr(handle), uintptr(unsafe.Pointer(&mem)), uintptr(mem.Cb))
	if r1 != 0 {
		memBytes = uint64(mem.WorkingSetSize)
	}
	return cpuSeconds, memBytes
}
