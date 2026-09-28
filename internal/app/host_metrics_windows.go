//go:build windows

package app

import (
	"errors"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// errPdhUnavailable 表示本进程内 PDH 计数器不可用（罕见）；此时速率一律报 0。
var errPdhUnavailable = errors.New("pdh counters unavailable")

// 磁盘与网络的速率来自 PDH 性能计数器（英文物化路径，与系统语言无关）。
// 查询句柄在首次采样时惰性创建并保留到进程结束；每次 PdhCollectQueryData
// 由前端 2 秒轮询驱动，格式化计数器直接给出字节/秒速率，后端无需保存上次样本。

var (
	pdh                                    = windows.NewLazySystemDLL("pdh.dll")
	procGetTickCount64                     = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetTickCount64")
	procPdhOpenQuery                       = pdh.NewProc("PdhOpenQueryW")
	procPdhAddEnglishCounterW              = pdh.NewProc("PdhAddEnglishCounterW")
	procPdhCollectQueryData                = pdh.NewProc("PdhCollectQueryData")
	procPdhCloseQuery                      = pdh.NewProc("PdhCloseQuery")
	procPdhGetFormattedCounterArrayW = pdh.NewProc("PdhGetFormattedCounterArrayW")
)

const (
	pdhFmtDouble = 0x00000200
	pdhMoreData  = 0x800007D2
)

// pdhFmtCounterItemDouble 对应 PDH_FMT_COUNTERVALUE_ITEM_DOUBLE（x64）。
// name 直接指向调用缓冲区内的 UTF-16 字符串，缓冲区在遍历期间保持存活。
type pdhFmtCounterItemDouble struct {
	name    *uint16
	cStatus uint32
	_       uint32
	value   float64
}

// pdhRateCollector 持有一组速率计数器；collect 返回各速率（字节/秒）。
type pdhRateCollector struct {
	mu       sync.Mutex
	query    uintptr
	handles  []uintptr
	primed   bool
	initErr  bool
}

var hostDiskNetRates = &pdhRateCollector{}

// pdhRateCounterPaths 顺序固定：磁盘读、磁盘写、网络发、网络收。
var pdhRateCounterPaths = []string{
	`\PhysicalDisk(*)\Disk Read Bytes/sec`,
	`\PhysicalDisk(*)\Disk Write Bytes/sec`,
	`\Network Interface(*)\Bytes Sent/sec`,
	`\Network Interface(*)\Bytes Received/sec`,
}

// ensureQuery 惰性打开查询并添加计数器；失败后不再重试（本进程内 PDH 不可用是稳定状态）。
func (c *pdhRateCollector) ensureQuery() error {
	if c.query != 0 {
		return nil
	}
	if c.initErr {
		return errPdhUnavailable
	}
	var query uintptr
	if r, _, _ := procPdhOpenQuery.Call(0, 0, uintptr(unsafe.Pointer(&query))); r != 0 {
		c.initErr = true
		return errPdhUnavailable
	}
	for _, path := range pdhRateCounterPaths {
		pathPtr, err := windows.UTF16PtrFromString(path)
		if err != nil {
			continue
		}
		var handle uintptr
		if r, _, _ := procPdhAddEnglishCounterW.Call(query, uintptr(unsafe.Pointer(pathPtr)), 0, uintptr(unsafe.Pointer(&handle))); r != 0 {
			continue
		}
		c.handles = append(c.handles, handle)
	}
	if len(c.handles) == 0 {
		procPdhCloseQuery.Call(query)
		c.initErr = true
		return errPdhUnavailable
	}
	c.query = query
	return nil
}

// sumFormatted 取单个计数器的全部实例速率并求和；跳过 PhysicalDisk 的 _Total
//（避免与各物理盘重复计数）与网络的 Loopback 实例。
func sumFormatted(handle uintptr, skipTotal bool) float64 {
	var size, count uint32
	const maxTries = 3
	for i := 0; i < maxTries; i++ {
		r, _, _ := procPdhGetFormattedCounterArrayW.Call(
			handle,
			pdhFmtDouble,
			uintptr(unsafe.Pointer(&size)),
			uintptr(unsafe.Pointer(&count)),
			0,
		)
		if r == 0 {
			return 0
		}
		if r != pdhMoreData {
			return 0
		}
		buf := make([]byte, size)
		r, _, _ = procPdhGetFormattedCounterArrayW.Call(
			handle,
			pdhFmtDouble,
			uintptr(unsafe.Pointer(&size)),
			uintptr(unsafe.Pointer(&count)),
			uintptr(unsafe.Pointer(&buf[0])),
		)
		if r != 0 {
			return 0
		}
		items := unsafe.Slice((*pdhFmtCounterItemDouble)(unsafe.Pointer(&buf[0])), count)
		var sum float64
		for _, item := range items {
			if item.cStatus != 0 {
				continue
			}
			instance := instanceName(item.name)
			if skipTotal && instance == "_Total" {
				continue
			}
			if skipTotal && isLoopbackInstance(instance) {
				continue
			}
			sum += item.value
		}
		return sum
	}
	return 0
}

func instanceName(name *uint16) string {
	if name == nil {
		return ""
	}
	return windows.UTF16PtrToString(name)
}

func isLoopbackInstance(name string) bool {
	return len(name) >= 8 && (name[0] == 'L' || name[0] == 'l') && name[1:8] == "oopback"
}

// collect 顺序返回：磁盘读、磁盘写、网络发、网络收（字节/秒）。
// 首次采集是基线（PDH 尚无时间差），速率按 0 处理，下一次轮询起有效。
func (c *pdhRateCollector) collect() (readBps, writeBps, sentBps, recvBps float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensureQuery(); err != nil {
		return 0, 0, 0, 0
	}
	if r, _, _ := procPdhCollectQueryData.Call(c.query); r != 0 {
		return 0, 0, 0, 0
	}
	if !c.primed {
		// 第二次采样才有时间差；此前格式化值无意义。
		if len(c.handles) > 0 {
			c.primed = true
		}
		return 0, 0, 0, 0
	}
	readBps = sumFormatted(c.handles[0], true)
	if len(c.handles) > 1 {
		writeBps = sumFormatted(c.handles[1], true)
	}
	if len(c.handles) > 2 {
		sentBps = sumFormatted(c.handles[2], true)
	}
	if len(c.handles) > 3 {
		recvBps = sumFormatted(c.handles[3], true)
	}
	return readBps, writeBps, sentBps, recvBps
}

// sampleHostExtraMetrics 填充开机时长与磁盘/网络速率；失败静默归零，不打断主采样。
func sampleHostExtraMetrics(sample *hostResourceSample) {
	r1, _, _ := procGetTickCount64.Call()
	sample.UptimeSeconds = uint64(r1) / 1000
	readBps, writeBps, sentBps, recvBps := hostDiskNetRates.collect()
	sample.DiskReadBps = readBps
	sample.DiskWriteBps = writeBps
	sample.NetUpBps = sentBps
	sample.NetDownBps = recvBps
}
