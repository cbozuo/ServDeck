//go:build !windows

package app

import "GoNavi-Wails/internal/connection"

// DetectJavaRuntimes 检测本机 Java 运行时；非 Windows 构建没有 SCM / 注册表，返回空列表。
func (a *App) DetectJavaRuntimes() connection.QueryResult {
	return connection.QueryResult{Success: true, Data: map[string]any{"candidates": []any{}}}
}
