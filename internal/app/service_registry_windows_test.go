package app

import "testing"

// TestParseServyVersionOutput 校验引擎 --version 输出的解析：不匹配文件名，只认输出格式。
func TestParseServyVersionOutput(t *testing.T) {
	tests := []struct {
		name   string
		output string
		want   string
	}{
		{"标准输出取语义化版本并去掉提交哈希", "Servy.CLI 10.1.0+976276e089e81fdd729dfdd81c7b8265eb459c73\n", "10.1.0"},
		{"无提交哈希", "Servy.CLI 11.0.2", "11.0.2"},
		{"前导空白容忍", "\n  Servy.CLI 12.3.0\n", "12.3.0"},
		{"非 Servy 输出拒绝", "Microsoft Windows [Version 10.0.26100]\n", ""},
		{"空输出拒绝", "", ""},
		{"只有产品名拒绝", "Servy.CLI", ""},
		{"纯加号版本拒绝", "Servy.CLI +abc", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseServyVersionOutput(tt.output); got != tt.want {
				t.Fatalf("parseServyVersionOutput(%q) = %q, want %q", tt.output, got, tt.want)
			}
		})
	}
}
