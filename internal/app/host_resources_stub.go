//go:build !windows

package app

import "errors"

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

var errHostResourcesUnsupported = errors.New("host resource sampling is only supported on windows")

func sampleHostResources() (hostResourceSample, error) {
	return hostResourceSample{}, errHostResourcesUnsupported
}
