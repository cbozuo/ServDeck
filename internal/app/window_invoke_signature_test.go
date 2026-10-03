//go:build windows

package app

import (
	"context"
	"reflect"
	"testing"
)

// wails 升级到 v2.16 时，desktop/windows.Window.Invoke 从 func(f func())
// 改成了 func(f func()) bool。仓库里有三处反射校验（zoom / bounds / background），
// 此前各自写死 NumOut()==0，导致线上恒定判定"签名变化"并静默放弃修复：
// 日志里累计出现 262 次 "mainWindow.Invoke signature changed"。
//
// 这个测试直接锁死两代 wails 的真实签名，防止再次把校验写窄。
func TestResolveMainWindowInvokeAcceptsBothWailsGenerations(t *testing.T) {
	tests := []struct {
		name    string
		window  any
		wantErr bool
	}{
		{name: "wails 2.16 returns bool", window: &fakeWindow{}},
		{name: "legacy returns nothing", window: &legacyInvokeWindow{}},
		{name: "wrong parameter kind", window: &badArgInvokeWindow{}, wantErr: true},
		{name: "too many results", window: &tooManyResultsInvokeWindow{}, wantErr: true},
		{name: "non-bool result", window: &nonBoolResultInvokeWindow{}, wantErr: true},
		{name: "callback takes arguments", window: &callbackWithArgsWindow{}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			invoke, err := resolveMainWindowInvoke(reflect.ValueOf(tt.window))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected signature validation to reject %T", tt.window)
				}
				return
			}
			if err != nil {
				t.Fatalf("expected %T to be accepted, got %v", tt.window, err)
			}
			if !invoke.IsValid() {
				t.Fatalf("expected a valid reflect.Value for %T", tt.window)
			}
		})
	}
}

// TestResetWebViewZoomFactorRunsAgainstRealWailsInvokeSignature 是防回归的核心断言：
// 走完整反射链路时必须真正调到 PutZoomFactor，而不是在签名校验处就返回错误。
func TestResetWebViewZoomFactorRunsAgainstRealWailsInvokeSignature(t *testing.T) {
	chromium := &fakeChromium{}
	window := &fakeWindow{}
	ctx := context.WithValue(context.Background(), stringContextKey("frontend"), &fakeFrontend{chromium: chromium, mainWindow: window})

	if err := resetWebViewZoomFactor(ctx, 1.0); err != nil {
		t.Fatalf("zoom reset must not fail on wails 2.16 Invoke signature, got %v", err)
	}
	if got := chromium.called.Load(); got != 1 {
		t.Fatalf("expected PutZoomFactor to actually run once, got %d", got)
	}
}

// Invoke 返回 false 表示派发失败，此时必须让调用方看到错误而不是静默成功。
func TestResetWebViewZoomFactorReportsInvokeDispatchFailure(t *testing.T) {
	chromium := &fakeChromium{}
	window := &fakeWindow{}
	window.failNext.Store(true)
	ctx := context.WithValue(context.Background(), stringContextKey("frontend"), &fakeFrontend{chromium: chromium, mainWindow: window})

	if err := resetWebViewZoomFactor(ctx, 1.0); err == nil {
		t.Fatal("expected an error when mainWindow.Invoke reports dispatch failure")
	}
}

type legacyInvokeWindow struct{}

func (l *legacyInvokeWindow) Invoke(fn func()) { fn() }

type badArgInvokeWindow struct{}

func (b *badArgInvokeWindow) Invoke(fn string) bool { return true }

type tooManyResultsInvokeWindow struct{}

func (t *tooManyResultsInvokeWindow) Invoke(fn func()) (bool, error) { fn(); return true, nil }

type nonBoolResultInvokeWindow struct{}

func (n *nonBoolResultInvokeWindow) Invoke(fn func()) int { fn(); return 0 }

type callbackWithArgsWindow struct{}

func (c *callbackWithArgsWindow) Invoke(fn func(int)) bool { fn(0); return true }
