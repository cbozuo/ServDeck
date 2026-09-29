//go:build !windows

package app

import "GoNavi-Wails/internal/connection"

// DetectJavaRuntimes 检测本机 Java 运行时；非 Windows 构建没有 SCM / 注册表，返回空列表。
func (a *App) DetectJavaRuntimes() connection.QueryResult {
	return connection.QueryResult{Success: true, Data: map[string]any{"candidates": []any{}}}
}

// DescribeJavaRuntime 非 Windows 构建无法执行 java -version，返回失败让前端回落纯文本反馈。
func (a *App) DescribeJavaRuntime(path string) connection.QueryResult {
	return connection.QueryResult{Success: false}
}
