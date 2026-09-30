//go:build windows

package app

import (
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// resolveWorkloadPID 返回指标采样应使用的 PID。servy 注册的服务 SCM PID 指向
// Servy.Service.CLI.exe 包装进程，真正的工作负载（java.exe 等）是其子进程，
// 直接采包装进程只会得到空闲指标；其余服务保持 SCM PID 不变。
func resolveWorkloadPID(scmPID uint32) uint32 {
	if scmPID == 0 || !isServyWrapperProcess(scmPID) {
		return scmPID
	}
	children := childProcessIDs(scmPID)
	if len(children) == 0 {
		// 启动间隙/子进程崩溃重启时暂采包装进程，下一轮采样自动切回
		return scmPID
	}
	if len(children) == 1 {
		return children[0]
	}
	return pickMainChild(children, func(pid uint32) uint64 {
		_, mem := sampleProcessMetrics(pid)
		return mem
	})
}

// isServyWrapperProcess 按映像名识别 servy 家族包装进程（Servy.Service.CLI.exe 等）。
func isServyWrapperProcess(pid uint32) bool {
	image := processImageName(pid)
	if image == "" {
		return false
	}
	if idx := strings.LastIndexAny(image, `\/`); idx >= 0 {
		image = image[idx+1:]
	}
	return strings.Contains(strings.ToLower(image), "servy")
}

// pickMainChild 多个子进程时取工作集最大的作为主负载。
func pickMainChild(children []uint32, workingSetOf func(uint32) uint64) uint32 {
	best := children[0]
	bestMem := workingSetOf(best)
	for _, pid := range children[1:] {
		if mem := workingSetOf(pid); mem > bestMem {
			best, bestMem = pid, mem
		}
	}
	return best
}

// childProcessIDs 用 Toolhelp 进程快照列出 pid 的直接子进程。
func childProcessIDs(pid uint32) []uint32 {
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(snapshot)

	entry := windows.ProcessEntry32{Size: uint32(unsafe.Sizeof(windows.ProcessEntry32{}))}
	if err := windows.Process32First(snapshot, &entry); err != nil {
		return nil
	}
	children := make([]uint32, 0, 4)
	for {
		if entry.ProcessID != pid && entry.ParentProcessID == pid {
			children = append(children, entry.ProcessID)
		}
		if err := windows.Process32Next(snapshot, &entry); err != nil {
			break
		}
	}
	return children
}
