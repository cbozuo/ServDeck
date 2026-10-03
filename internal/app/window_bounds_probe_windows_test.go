//go:build windows

package app

import (
	"reflect"
	"testing"
)

type probeFakeWindow struct {
	handle uintptr
}

func (p *probeFakeWindow) Handle() uintptr { return p.handle }

func TestProbeClientRectRejectsZeroHandle(t *testing.T) {
	if _, ok := probeClientRect(0); ok {
		t.Fatal("a zero window handle must not report a successful client rect probe")
	}
}

func TestProbeMainWindowHandleReturnsHandle(t *testing.T) {
	value := reflect.ValueOf(&probeFakeWindow{handle: 0x1234})
	if got := probeMainWindowHandle(value); got != 0x1234 {
		t.Fatalf("expected handle 0x1234, got 0x%x", got)
	}
}

func TestProbeMainWindowHandleIgnoresNonWindowValue(t *testing.T) {
	// 没有 Handle 方法的值必须安全返回 0，让调用方退化为无条件追帧。
	if got := probeMainWindowHandle(reflect.ValueOf(struct{}{})); got != 0 {
		t.Fatalf("expected 0 for a value without Handle(), got 0x%x", got)
	}
}

func TestWebViewBoundsAlreadySyncedReportsProbeFailure(t *testing.T) {
	// 句柄为 0 时探测无法进行：synced 必须是 false，probeOK 也必须是 false，
	// 调用方据此退化为旧的无条件追帧，绝不能因为探测失败而漏修。
	synced, probeOK := webViewBoundsAlreadySynced(reflect.ValueOf(&probeFakeWindow{}), reflect.Value{})
	if synced {
		t.Fatal("must not report synced when the window handle is unavailable")
	}
	if probeOK {
		t.Fatal("must report probe failure so the caller falls back to unconditional refresh")
	}
}

// 测试回调需要 GC 指针与 syscall 回调签名一致，这里只验证 rect 尺寸换算。
func TestProbeInt32Size(t *testing.T) {
	tests := []struct {
		name       string
		rect       probeRect
		wantWidth  int64
		wantHeight int64
	}{
		{name: "normal", rect: probeRect{Left: 0, Top: 0, Right: 1920, Bottom: 1080}, wantWidth: 1920, wantHeight: 1080},
		{name: "offset origin", rect: probeRect{Left: 100, Top: 50, Right: 1120, Bottom: 650}, wantWidth: 1020, wantHeight: 600},
		{name: "empty", rect: probeRect{}, wantWidth: 0, wantHeight: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			width, height := probeInt32Size(tt.rect)
			if width != tt.wantWidth || height != tt.wantHeight {
				t.Fatalf("expected %dx%d, got %dx%d", tt.wantWidth, tt.wantHeight, width, height)
			}
		})
	}
}

func TestAbs64(t *testing.T) {
	if got := abs64(-5); got != 5 {
		t.Fatalf("expected 5, got %d", got)
	}
	if got := abs64(5); got != 5 {
		t.Fatalf("expected 5, got %d", got)
	}
	if got := abs64(0); got != 0 {
		t.Fatalf("expected 0, got %d", got)
	}
}
