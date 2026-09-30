//go:build !js

package appdata

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DefaultLogRetentionDays 服务日志默认保留天数（用户未配置时生效）。
const DefaultLogRetentionDays = 7

// LogRetentionPermanent 表示永久保留（禁用自动清理）的内部哨兵值。
const LogRetentionPermanent = -1

// ResolveLogRetentionDays 返回生效的保留天数：用户显式配置优先（-1 → 0 表示禁用清理），
// 未配置走默认 7 天。返回值 <=0 一律视为「不清理」。
func ResolveLogRetentionDays() int {
	cfg, err := readBootstrapConfig()
	if err != nil {
		return DefaultLogRetentionDays
	}
	switch {
	case cfg.LogRetentionDays == LogRetentionPermanent:
		return 0
	case cfg.LogRetentionDays > 0:
		return cfg.LogRetentionDays
	default:
		return DefaultLogRetentionDays
	}
}

// SetLogRetentionDays 保存保留天数：days=-1 永久保留；1..365 为天数；其余取值非法。
func SetLogRetentionDays(days int) error {
	if days != LogRetentionPermanent && (days < 1 || days > 365) {
		return fmt.Errorf("log retention days out of range: %d", days)
	}
	return updateBootstrapConfig(func(cfg *bootstrapConfig) {
		cfg.LogRetentionDays = days
	})
}

// CleanExpiredServiceLogs 遍历 <数据根>/services/*/logs/，删除最后修改时间早于
// 保留期限的日志文件（service-*.log 与轮转产物 .log.N / .log.日期）。
// retentionDays <= 0 表示永久保留，直接返回。活跃日志由引擎持续写入、mtime 常新，
// 天然不会被误删；停止超过保留期的服务日志会整目录清空。
func CleanExpiredServiceLogs(retentionDays int) (int, error) {
	root, err := ResolveActiveRoot()
	if err != nil {
		return 0, fmt.Errorf("resolve app data root: %w", err)
	}
	return cleanExpiredServiceLogsIn(root, retentionDays)
}

func cleanExpiredServiceLogsIn(root string, retentionDays int) (int, error) {
	if retentionDays <= 0 {
		return 0, nil // 0 = 永久保留（禁用清理）
	}
	servicesDir := filepath.Join(root, "services")
	services, err := os.ReadDir(servicesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("read services dir: %w", err)
	}
	deadline := time.Now().AddDate(0, 0, -retentionDays)
	removed := 0
	for _, service := range services {
		if !service.IsDir() {
			continue
		}
		logsDir := filepath.Join(servicesDir, service.Name(), "logs")
		files, err := os.ReadDir(logsDir)
		if err != nil {
			continue // 无 logs 目录（未注册/已清理）跳过
		}
		for _, file := range files {
			if file.IsDir() || !isServiceLogFileName(file.Name()) {
				continue
			}
			info, err := file.Info()
			if err != nil || info.ModTime().After(deadline) {
				continue
			}
			if err := os.Remove(filepath.Join(logsDir, file.Name())); err == nil {
				removed++
			}
		}
	}
	return removed, nil
}

// isServiceLogFileName 判断是否服务日志文件：*.log 及其轮转产物（.log.1 / .log.2026-09-30 等）。
func isServiceLogFileName(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasSuffix(lower, ".log") || strings.Contains(lower, ".log.")
}
