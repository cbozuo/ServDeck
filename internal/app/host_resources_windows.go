//go:build windows

package app

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	kernel32                = windows.NewLazySystemDLL("kernel32.dll")
	procGlobalMemoryStatusEx = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetSystemTimes       = kernel32.NewProc("GetSystemTimes")
)

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

// sampleHostResources 采集 CPU 累计时间（idle/kernel/user）、物理内存、磁盘 C: 用量。
func sampleHostResources() (hostResourceSample, error) {
	sample := hostResourceSample{
		CPU:    map[string]uint64{},
		Memory: map[string]uint64{},
	}

	var idle, kernel, user windows.Filetime
	r1, _, callErr := procGetSystemTimes.Call(
		uintptr(unsafe.Pointer(&idle)),
		uintptr(unsafe.Pointer(&kernel)),
		uintptr(unsafe.Pointer(&user)),
	)
	if r1 == 0 {
		return sample, fmt.Errorf("GetSystemTimes: %w", callErr)
	}
	sample.CPU = map[string]uint64{
		"idle":   uint64(idle.HighDateTime)<<32 | uint64(idle.LowDateTime),
		"kernel": uint64(kernel.HighDateTime)<<32 | uint64(kernel.LowDateTime),
		"user":   uint64(user.HighDateTime)<<32 | uint64(user.LowDateTime),
	}

	var memStatus memoryStatusEx
	memStatus.Length = uint32(unsafe.Sizeof(memStatus))
	r1, _, callErr = procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&memStatus)))
	if r1 == 0 {
		return sample, fmt.Errorf("GlobalMemoryStatusEx: %w", callErr)
	}
	sample.Memory = map[string]uint64{
		"total":     memStatus.TotalPhys,
		"avail":     memStatus.AvailPhys,
		"memoryLoad": uint64(memStatus.MemoryLoad),
	}

	var driveTotal, driveFree uint64
	root, err := windows.UTF16PtrFromString(`C:\`)
	if err != nil {
		return sample, err
	}
	if err := windows.GetDiskFreeSpaceEx(root, nil, &driveTotal, &driveFree); err != nil {
		return sample, fmt.Errorf("GetDiskFreeSpaceEx C:: %w", err)
	}
	used := driveTotal - driveFree
	usedPct := 0
	if driveTotal > 0 {
		usedPct = int(used * 100 / driveTotal)
	}
	sample.Disks = append(sample.Disks, hostDiskInfo{
		Drive:   "C:",
		Total:   driveTotal,
		Free:    driveFree,
		Used:    used,
		UsedPct: usedPct,
	})

	sampleHostExtraMetrics(&sample)

	return sample, nil
}
