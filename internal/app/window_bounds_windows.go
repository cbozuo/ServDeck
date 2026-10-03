//go:build windows

package app

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"GoNavi-Wails/internal/logger"
)

const refreshWebViewBoundsInvokeTimeout = 2 * time.Second

// refreshWebViewBounds forces WebView2's controller bounds to match the current
// native client rect. Wails normally does this from WM_SIZE, but a late startup
// maximise can expose WS_MAXIMIZE before that resize reaches the WebView surface.
//
// chromium.Resize() 是一次真实的 put_Bounds，会让 Chromium 把整个视口重新光栅。
// wails 内建 WM_SIZE 已经做过同样的事，所以这里**必须先比对边界**：
// 只有 WebView2 窗口与原生客户区确实不一致时才追这一帧。
// 无条件追帧 = 每次都多一次全页重排，叠加前端 resize 自激（见
// frontend/src/utils/windowsWindowScaleRepair.ts 的 notifyResize）就是肉眼可见的闪烁。
func refreshWebViewBounds(ctx context.Context) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("refresh WebView2 bounds panic: %v", recovered)
		}
	}()
	if ctx == nil {
		return fmt.Errorf("ctx is nil")
	}

	frontendValue, err := resolveWailsFrontendValue(ctx)
	if err != nil {
		return err
	}
	chromiumValue, err := accessibleWailsFrontendField(frontendValue, "chromium")
	if err != nil {
		return err
	}
	mainWindowValue, err := accessibleWailsFrontendField(frontendValue, "mainWindow")
	if err != nil {
		return err
	}

	// 幂等闸门：边界已一致时直接返回，不产生第二次 put_Bounds。
	alreadySynced, probeOK := webViewBoundsAlreadySynced(mainWindowValue, chromiumValue)
	switch {
	case probeOK && alreadySynced:
		// 正常稳态：wails 内建 WM_SIZE 已经追过帧，这里不再重复 PutBounds。
		return nil
	case !probeOK:
		// 探测失败退化为无条件追帧，保持与旧行为一致，不因探测失败而漏修。
		logger.Warnf("WebView2 边界一致性探测失败，退化为无条件追帧")
	}

	resize := chromiumValue.MethodByName("Resize")
	if !resize.IsValid() {
		return fmt.Errorf("Resize method not found on chromium (go-webview2 version may have changed)")
	}
	if resize.Type().NumIn() != 0 || resize.Type().NumOut() != 0 {
		return fmt.Errorf("Resize signature changed: expected func(), got %v", resize.Type())
	}

	invoke, err := resolveMainWindowInvoke(mainWindowValue)
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	if err := safeCallInvoke(invoke, func() {
		done <- safeCallResizeWebView(resize)
	}); err != nil {
		return err
	}

	select {
	case err := <-done:
		return err
	case <-time.After(refreshWebViewBoundsInvokeTimeout):
		return fmt.Errorf("timed out waiting for mainWindow.Invoke to refresh WebView2 bounds")
	}
}

func safeCallResizeWebView(resize reflect.Value) (err error) {
	defer func() {
		if value := recover(); value != nil {
			err = fmt.Errorf("Resize panicked while refreshing WebView2 bounds: %v", value)
		}
	}()
	resize.Call(nil)
	return nil
}
