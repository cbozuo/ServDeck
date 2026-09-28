//go:build windows

package app

import (
	"errors"
	"fmt"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

// serviceControlTimeout 是 restart 等待服务停稳的上限；超时视为失败并让前端提示。
const serviceControlTimeout = 15 * time.Second

// controlServiceEntry 通过 SCM 执行启停。start 遇到"已在运行"、stop 遇到"未运行"都视为成功，
// 保证按钮幂等；restart 串行等待停止完成后再启动。
func controlServiceEntry(name string, action string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect SCM: %w", err)
	}
	defer m.Disconnect()

	service, err := m.OpenService(name)
	if err != nil {
		return fmt.Errorf("open service %s: %w", name, err)
	}
	defer service.Close()

	switch action {
	case "start":
		return startServiceEntry(service)
	case "stop":
		return stopServiceEntry(service)
	case "restart":
		if err := stopServiceEntry(service); err != nil {
			return err
		}
		return startServiceEntry(service)
	default:
		return fmt.Errorf("unknown action %s", action)
	}
}

func startServiceEntry(service *mgr.Service) error {
	if err := service.Start(); err != nil {
		if errors.Is(err, windows.ERROR_SERVICE_ALREADY_RUNNING) {
			return nil
		}
		return fmt.Errorf("start service %s: %w", service.Name, err)
	}
	return nil
}

func stopServiceEntry(service *mgr.Service) error {
	status, err := service.Control(svc.Stop)
	if err != nil {
		if errors.Is(err, windows.ERROR_SERVICE_NOT_ACTIVE) {
			return nil
		}
		return fmt.Errorf("stop service %s: %w", service.Name, err)
	}
	deadline := time.Now().Add(serviceControlTimeout)
	for status.State != svc.Stopped {
		if time.Now().After(deadline) {
			return fmt.Errorf("stop service %s: timeout waiting for stopped state", service.Name)
		}
		time.Sleep(300 * time.Millisecond)
		if status, err = service.Query(); err != nil {
			return fmt.Errorf("query service %s: %w", service.Name, err)
		}
	}
	return nil
}
