//go:build windows

package app

import (
	"strings"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// serviceDetailSample 是详情页一次 2 秒采样的指标集。
// cpuPct/threads/handles/disk 由 PDH 按进程实例给出（与主机/服务列表采样同基建）。
type serviceDetailSample struct {
	State     string  `json:"state"`
	PID       uint32  `json:"pid"`
	CPUTotal  float64 `json:"cpuTotal"`
	MemBytes  uint64  `json:"memBytes"`
	Threads   uint64  `json:"threads"`
	Handles   uint64  `json:"handles"`
	DiskRead  float64 `json:"diskReadBps"`
	DiskWrite float64 `json:"diskWriteBps"`
	NetConns  int     `json:"netConns"`
}

// detailPdhPaths 顺序固定：线程数、句柄数、磁盘读、磁盘写、ID Process。
var detailPdhPaths = []string{
	`\Process(*)\Thread Count`,
	`\Process(*)\Handle Count`,
	`\Process(*)\IO Read Bytes/sec`,
	`\Process(*)\IO Write Bytes/sec`,
	`\Process(*)\ID Process`,
}

// serviceDetailCollector 为详情页维护独立 PDH 查询（进程实例按 PID 动态匹配）。
var serviceDetailCollector = &pdhMultiCollector{paths: detailPdhPaths}

// pdhMultiCollector 是多计数器 PDH 查询的通用封装（首次惰性创建，进程内复用）。
type pdhMultiCollector struct {
	mu      sync.Mutex
	query   uintptr
	handles []uintptr
	paths   []string
	primed  bool
	failed  bool
}

func (c *pdhMultiCollector) ensure() error {
	if c.query != 0 {
		return nil
	}
	if c.failed {
		return errPdhUnavailable
	}
	var query uintptr
	if r, _, _ := procPdhOpenQuery.Call(0, 0, uintptr(unsafe.Pointer(&query))); r != 0 {
		c.failed = true
		return errPdhUnavailable
	}
	for _, path := range c.paths {
		ptr, err := windows.UTF16PtrFromString(path)
		if err != nil {
			continue
		}
		var handle uintptr
		if r, _, _ := procPdhAddEnglishCounterW.Call(query, uintptr(unsafe.Pointer(ptr)), 0, uintptr(unsafe.Pointer(&handle))); r != 0 {
			continue
		}
		c.handles = append(c.handles, handle)
	}
	if len(c.handles) == 0 {
		procPdhCloseQuery.Call(query)
		c.failed = true
		return errPdhUnavailable
	}
	c.query = query
	return nil
}

// collect 采集一次全部计数器并按实例名返回 map（实例名 → 值数组，顺序与 paths 一致）。
func (c *pdhMultiCollector) collect() (map[string][]float64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensure(); err != nil {
		return nil, err
	}
	if r, _, _ := procPdhCollectQueryData.Call(c.query); r != 0 {
		return nil, errPdhUnavailable
	}
	if !c.primed {
		c.primed = true
		return map[string][]float64{}, nil // 首次为基线，无有效值
	}
	result := map[string][]float64{}
	for idx, handle := range c.handles {
		values := pdhValuesByInstance(handle)
		for instance, value := range values {
			arr, ok := result[instance]
			if !ok {
				arr = make([]float64, len(c.handles))
				result[instance] = arr
			}
			arr[idx] = value
		}
	}
	return result, nil
}

// pdhValuesByInstance 取单计数器全部实例的 double 值（实例名 → 值）。
func pdhValuesByInstance(handle uintptr) map[string]float64 {
	values := map[string]float64{}
	var size, count uint32
	for i := 0; i < 3; i++ {
		r, _, _ := procPdhGetFormattedCounterArrayW.Call(
			handle, pdhFmtDouble,
			uintptr(unsafe.Pointer(&size)), uintptr(unsafe.Pointer(&count)), 0,
		)
		if r == 0 {
			return values
		}
		if r != pdhMoreData {
			return values
		}
		buf := make([]byte, size)
		r, _, _ = procPdhGetFormattedCounterArrayW.Call(
			handle, pdhFmtDouble,
			uintptr(unsafe.Pointer(&size)), uintptr(unsafe.Pointer(&count)), uintptr(unsafe.Pointer(&buf[0])),
		)
		if r != 0 {
			return values
		}
		items := unsafe.Slice((*pdhFmtCounterItemDouble)(unsafe.Pointer(&buf[0])), count)
		for _, item := range items {
			if item.cStatus != 0 {
				continue
			}
			values[instanceName(item.name)] = item.value
		}
		return values
	}
	return values
}

// sampleServiceDetailMetrics 采样指定服务的实时指标；服务未运行或实例未匹配时零值。
func sampleServiceDetailMetrics(name string) *serviceDetailSample {
	sample := &serviceDetailSample{State: "Unknown"}
	detail, err := buildServiceDetailSnapshot(name)
	if err != nil {
		return sample
	}
	sample.State = detail.State
	sample.PID = detail.PID
	if sample.State != "Running" || sample.PID == 0 {
		return sample
	}

	values, err := serviceDetailCollector.collect()
	if err != nil {
		return sample
	}
	sample.NetConns = pidConnectionCount(sample.PID)
	cpuSeconds, mem := sampleProcessMetrics(sample.PID)
	sample.CPUTotal = cpuSeconds
	sample.MemBytes = mem // 复用服务列表采样的工作集读取

	instance, ok := matchProcessInstance(values, sample.PID)
	if !ok {
		return sample
	}
	// paths 顺序：Thread(0) Handle(1) DiskRead(2) DiskWrite(3) ID(4)
	sample.Threads = uint64(values[instance][0])
	sample.Handles = uint64(values[instance][1])
	sample.DiskRead = values[instance][2]
	sample.DiskWrite = values[instance][3]
	return sample
}

// matchProcessInstance 在 PDH 实例表里按 ID Process 找到目标实例。
// 同名多实例的实例名带 #N 后缀，按 ID 匹配最可靠。
func matchProcessInstance(values map[string][]float64, pid uint32) (string, bool) {
	idIdx := len(detailPdhPaths) - 1
	for instance, arr := range values {
		if len(arr) > idIdx && uint32(arr[idIdx]) == pid {
			return instance, true
		}
	}
	// 回退：实例名匹配进程映像名（PDH 偶发 ID 计数器缺值）
	for instance := range values {
		if instanceBaseName(instance) != "" && strings.EqualFold(instanceBaseName(instance), processBaseName(pid)) {
			return instance, true
		}
	}
	return "", false
}

func instanceBaseName(instance string) string {
	if idx := strings.LastIndex(instance, "#"); idx > 0 {
		return instance[:idx]
	}
	return instance
}

func processBaseName(pid uint32) string {
	image := processImageName(pid)
	if image == "" {
		return ""
	}
	if idx := strings.LastIndexAny(image, `\/`); idx >= 0 {
		image = image[idx+1:]
	}
	return strings.TrimSuffix(image, ".exe")
}

// pidConnectionCount 统计该 PID 的 TCP+UDP 连接数（iphlpapi GetExtended*Table 手动绑定，
// x/sys/windows 未封装这些导出；行结构为 MIB_TCPROW_OWNER_PID / MIB_UDPROW_OWNER_PID）。
var (
	iphlpapi                 = windows.NewLazySystemDLL("iphlpapi.dll")
	procGetExtendedTcpTable  = iphlpapi.NewProc("GetExtendedTcpTable")
	procGetExtendedUdpTable  = iphlpapi.NewProc("GetExtendedUdpTable")
)

const (
	tcpTableOwnerPidAll      = 5
	udpTableOwnerPid         = 1
	tcpOwnerPidRowSize       = 24
	udpOwnerPidRowSize       = 16
	ownerPidRowPidOffset     = 8
)

func pidConnectionCount(pid uint32) int {
	return countExtendedRowsWithPid(procGetExtendedTcpTable, tcpTableOwnerPidAll, tcpOwnerPidRowSize, pid) +
		countExtendedRowsWithPid(procGetExtendedUdpTable, udpTableOwnerPid, udpOwnerPidRowSize, pid)
}

// countExtendedRowsWithPid 调用 GetExtended*Table 并统计 owner PID 匹配的行数。
func countExtendedRowsWithPid(proc *windows.LazyProc, tableClass uint32, rowSize int, pid uint32) int {
	buf := make([]byte, 64*1024)
	size := uint32(len(buf))
	ret, _, _ := proc.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
		0,
		windows.AF_INET,
		uintptr(tableClass),
		0,
	)
	if ret != 0 {
		return 0
	}
	if size < 4 {
		return 0
	}
	count := *(*uint32)(unsafe.Pointer(&buf[0]))
	total := 0
	for i := uint32(0); i < count; i++ {
		offset := uintptr(4) + uintptr(i)*uintptr(rowSize) + ownerPidRowPidOffset
		if offset+4 > uintptr(size) {
			break
		}
		rowPid := uint32(buf[offset]) | uint32(buf[offset+1])<<8 | uint32(buf[offset+2])<<16 | uint32(buf[offset+3])<<24
		if rowPid == pid {
			total++
		}
	}
	return total
}
