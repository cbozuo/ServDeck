//go:build windows

package app

import (
	"fmt"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

type serviceEntry struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	State       string `json:"state"`
	StartType   string `json:"startType"`
}

// listServiceEntries 枚举 SCM 全部 Win32 服务并逐个取状态与启动类型。
func listServiceEntries() ([]serviceEntry, error) {
	m, err := mgr.Connect()
	if err != nil {
		return nil, fmt.Errorf("connect SCM: %w", err)
	}
	defer m.Disconnect()

	names, err := m.ListServices()
	if err != nil {
		return nil, fmt.Errorf("list services: %w", err)
	}

	result := make([]serviceEntry, 0, len(names))
	for _, name := range names {
		entry := serviceEntry{Name: name}
		service, err := m.OpenService(name)
		if err == nil {
			if status, err := service.Query(); err == nil {
				entry.State = serviceStateString(status.State)
			}
			if config, err := service.Config(); err == nil {
				entry.DisplayName = config.DisplayName
				entry.StartType = serviceStartTypeString(config.StartType)
			}
			service.Close()
		}
		result = append(result, entry)
	}
	return result, nil
}

var _ = svc.Stopped // 保持 svc 导入（serviceStateString 在 service_registry_windows.go）
