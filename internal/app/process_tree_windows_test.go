//go:build windows

package app

import "testing"

func TestPickMainChild(t *testing.T) {
	tests := []struct {
		name     string
		children []uint32
		working  map[uint32]uint64
		want     uint32
	}{
		{name: "单子进程直接返回", children: []uint32{100}, working: map[uint32]uint64{100: 1}, want: 100},
		{name: "多子进程取工作集最大", children: []uint32{100, 200, 300}, working: map[uint32]uint64{100: 10, 200: 999, 300: 20}, want: 200},
		{name: "查询失败按零值取首个", children: []uint32{100, 200}, working: map[uint32]uint64{}, want: 100},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := pickMainChild(tt.children, func(pid uint32) uint64 { return tt.working[pid] })
			if got != tt.want {
				t.Fatalf("pickMainChild(%v) = %d, want %d", tt.children, got, tt.want)
			}
		})
	}
}
