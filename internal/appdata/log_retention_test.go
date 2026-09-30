package appdata

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// 写一个日志文件并把 mtime 拨到指定时刻（相对现在的天数偏移，可为负）。
func writeLogFile(t *testing.T, dir string, name string, ageDays float64) {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("log"), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
	if ageDays == 0 {
		return
	}
	stamp := time.Now().Add(time.Duration(ageDays * 24 * float64(time.Hour)))
	if err := os.Chtimes(path, stamp, stamp); err != nil {
		t.Fatalf("chtimes %s: %v", name, err)
	}
}

func TestCleanExpiredServiceLogs(t *testing.T) {
	root := t.TempDir()
	logsDir := filepath.Join(root, "services", "svc-a", "logs")
	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	// 活跃日志（现在）+ 过期主日志 + 过期轮转文件 + 非 .log 文件（不清理）+ 新服务目录外的空目录
	writeLogFile(t, logsDir, "service-out.log", 0)
	writeLogFile(t, logsDir, "service-err.log", -10)
	writeLogFile(t, logsDir, "service-out.log.1", -10)
	writeLogFile(t, logsDir, "notes.txt", -10)
	otherDir := filepath.Join(root, "services", "svc-b")
	if err := os.MkdirAll(filepath.Join(otherDir, "logs"), 0o755); err != nil {
		t.Fatal(err)
	}

	removed, err := cleanExpiredServiceLogsIn(root, 7)
	if err != nil {
		t.Fatalf("clean: %v", err)
	}
	if removed != 2 {
		t.Fatalf("expected 2 removed, got %d", removed)
	}
	for _, name := range []string{"service-out.log", "notes.txt"} {
		if _, err := os.Stat(filepath.Join(logsDir, name)); err != nil {
			t.Fatalf("%s 应保留: %v", name, err)
		}
	}
	for _, name := range []string{"service-err.log", "service-out.log.1"} {
		if _, err := os.Stat(filepath.Join(logsDir, name)); !os.IsNotExist(err) {
			t.Fatalf("%s 应被清理", name)
		}
	}
}

func TestCleanExpiredServiceLogsDisabled(t *testing.T) {
	root := t.TempDir()
	logsDir := filepath.Join(root, "services", "svc", "logs")
	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	writeLogFile(t, logsDir, "service-out.log", -30)
	// 0 = 永久保留（禁用清理）
	removed, err := cleanExpiredServiceLogsIn(root, 0)
	if err != nil {
		t.Fatalf("clean: %v", err)
	}
	if removed != 0 {
		t.Fatalf("永久保留时不应删除, removed=%d", removed)
	}
	if _, err := os.Stat(filepath.Join(logsDir, "service-out.log")); err != nil {
		t.Fatalf("文件应保留: %v", err)
	}
}

func TestResolveLogRetentionDaysDefaults(t *testing.T) {
	// 隔离到临时 HOME：本测试会读写 storage_root.json，不能碰用户真实配置
	homeDir := t.TempDir()
	t.Setenv("HOME", homeDir)
	t.Setenv("USERPROFILE", homeDir)
	// bootstrap 未配置 → 默认 7 天
	if got := ResolveLogRetentionDays(); got != DefaultLogRetentionDays {
		t.Fatalf("default retention: want %d, got %d", DefaultLogRetentionDays, got)
	}
	// 显式永久（-1）→ 0（内部禁用清理）
	if err := SetLogRetentionDays(LogRetentionPermanent); err != nil {
		t.Fatalf("set permanent: %v", err)
	}
	if got := ResolveLogRetentionDays(); got != 0 {
		t.Fatalf("permanent: want 0, got %d", got)
	}
	// 显式天数
	if err := SetLogRetentionDays(30); err != nil {
		t.Fatalf("set 30: %v", err)
	}
	if got := ResolveLogRetentionDays(); got != 30 {
		t.Fatalf("30 days: want 30, got %d", got)
	}
	// 非法值拒绝
	if err := SetLogRetentionDays(400); err == nil {
		t.Fatal("400 天应被拒绝")
	}
}
