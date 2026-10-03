//go:build windows

package app

import (
	"context"
	"fmt"
	"reflect"
	"time"
	"unsafe"
)

const resetWebViewZoomInvokeTimeout = 2 * time.Second

// resetWebViewZoomFactor 通过 WebView2 ICoreWebView2Controller::put_ZoomFactor 把 WebView2
// 内部 zoom factor 重置为 1.0。这是 Windows 任务栏恢复后字体度量异常变大的根因解：
// 字体度量缓存在 WebView2 D2D/DirectWrite 层，Chromium layout invalidation（CSS zoom hack）
// 改不了它，必须调 WebView2 COM API。
//
// 实现路径：
//  1. Wails 在 ctx 里以 key "frontend" 注入了 *desktop/windows.Frontend
//  2. Frontend.chromium 是 unexported 字段 *edge.Chromium
//  3. Frontend.mainWindow 是 unexported 字段 *windows.Window，可用 Invoke 切回窗口线程
//  4. Chromium.PutZoomFactor(float64) 是 exported 方法（封装了 controller.put_ZoomFactor）
//
// 用反射 + unsafe.Pointer 解锁 unexported 字段后，通过 mainWindow.Invoke 调 PutZoomFactor。
// 不需要 import wails 内部包，也不需要 fork wails。
//
// 失败时返回错误（不 panic），让调用方决定是否回退到 toggle 路径。
//
// **依赖 wails v2.11/v2.12 内部实现细节**：如果 wails 升级改名了 frontend.chromium 字段或
// edge.Chromium.PutZoomFactor 方法名，此函数会返回 error。CI 中应该有跨版本兼容性测试。
func resetWebViewZoomFactor(ctx context.Context, factor float64) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("reset WebView2 zoom panic: %v", recovered)
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

	putZoomFactor := chromiumValue.MethodByName("PutZoomFactor")
	if !putZoomFactor.IsValid() {
		return fmt.Errorf("PutZoomFactor method not found on chromium (go-webview2 version may have changed)")
	}
	if putZoomFactor.Type().NumIn() != 1 || putZoomFactor.Type().In(0).Kind() != reflect.Float64 || putZoomFactor.Type().NumOut() != 0 {
		return fmt.Errorf("PutZoomFactor signature changed: expected func(float64), got %v", putZoomFactor.Type())
	}

	invoke, err := resolveMainWindowInvoke(mainWindowValue)
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	if err := safeCallInvoke(invoke, func() {
		done <- safeCallPutZoomFactor(putZoomFactor, factor)
	}); err != nil {
		return err
	}

	select {
	case err := <-done:
		return err
	case <-time.After(resetWebViewZoomInvokeTimeout):
		return fmt.Errorf("timed out waiting for mainWindow.Invoke to reset WebView2 zoom factor")
	}
}

func resolveWailsFrontendValue(ctx context.Context) (reflect.Value, error) {
	frontendIface := ctx.Value("frontend")
	if frontendIface == nil {
		return reflect.Value{}, fmt.Errorf("wails frontend not found in ctx (key=\"frontend\")")
	}

	frontendValue := reflect.ValueOf(frontendIface)
	for depth := 0; depth < 8; depth++ {
		for frontendValue.IsValid() && (frontendValue.Kind() == reflect.Interface || frontendValue.Kind() == reflect.Ptr) {
			if frontendValue.IsNil() {
				return reflect.Value{}, fmt.Errorf("wails frontend is nil")
			}
			frontendValue = frontendValue.Elem()
		}
		if !frontendValue.IsValid() || frontendValue.Kind() != reflect.Struct {
			return reflect.Value{}, fmt.Errorf("wails frontend has unexpected kind %v", frontendValue.Kind())
		}
		if !frontendValue.CanAddr() {
			return reflect.Value{}, fmt.Errorf("wails frontend is not addressable")
		}

		// In a production build, ctx["frontend"] is the platform Frontend
		// itself. In `wails dev`, it is DevWebServer, which anonymously embeds
		// frontend.Frontend and delegates to the same platform value. Unwrap the
		// exported interface before looking for Windows-only private fields.
		if frontendValue.FieldByName("chromium").IsValid() && frontendValue.FieldByName("mainWindow").IsValid() {
			return frontendValue, nil
		}
		embeddedFrontend := frontendValue.FieldByName("Frontend")
		if !embeddedFrontend.IsValid() {
			return frontendValue, nil
		}
		frontendValue = embeddedFrontend
	}
	return reflect.Value{}, fmt.Errorf("wails frontend wrapper nesting exceeds supported depth")
}

func accessibleWailsFrontendField(frontendValue reflect.Value, fieldName string) (reflect.Value, error) {
	field := frontendValue.FieldByName(fieldName)
	if !field.IsValid() {
		return reflect.Value{}, fmt.Errorf("wails Frontend.%s field not found (wails version may have changed)", fieldName)
	}
	if !field.CanAddr() {
		return reflect.Value{}, fmt.Errorf("wails Frontend.%s field is not addressable", fieldName)
	}
	if isNilReflectValue(field) {
		return reflect.Value{}, fmt.Errorf("wails Frontend.%s is nil (WebView2 not yet initialised)", fieldName)
	}

	return reflect.NewAt(field.Type(), unsafe.Pointer(field.UnsafeAddr())).Elem(), nil
}

func isNilReflectValue(value reflect.Value) bool {
	switch value.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Ptr, reflect.Slice:
		return value.IsNil()
	default:
		return false
	}
}

func safeCallInvoke(invoke reflect.Value, fn func()) (err error) {
	defer func() {
		if value := recover(); value != nil {
			err = fmt.Errorf("mainWindow.Invoke panicked: %v", value)
		}
	}()
	results := invoke.Call([]reflect.Value{reflect.ValueOf(fn)})
	// wails v2.16 起 Invoke 改为 func(func()) bool，true 表示已同步执行或
	// PostMessage 派发成功，false 表示派发失败。早期版本返回 0 个值。
	// 按实际返回值个数解析，不要再写死 NumOut()==0。
	if len(results) > 0 && results[0].Kind() == reflect.Bool && !results[0].Bool() {
		return fmt.Errorf("mainWindow.Invoke failed to dispatch the callback to the window thread")
	}
	return nil
}

// resolveMainWindowInvoke 取出 wails 主窗口的 Invoke 方法并校验签名。
//
// wails v2.16 的 Invoke 签名是 func(f func()) bool——比 v2.15 多一个 bool 返回值。
// 此前三处反射校验各自写死 NumOut()==0，导致 2.16 下**永远**判定"签名变化"并静默放弃：
//   - ResetWebViewZoom 失效 → 任务栏恢复/DPI 变化后字体度量不重算
//   - RefreshWebViewBounds 失效 → WebView2 边界追帧全部落空
//   - SetBackgroundColour 同步失效 → put_Bounds 后的空窗回落到默认白
// 统一放宽为"0 或 1 个返回值"，两代 wails 都能工作。
func resolveMainWindowInvoke(mainWindowValue reflect.Value) (reflect.Value, error) {
	invoke := mainWindowValue.MethodByName("Invoke")
	if !invoke.IsValid() {
		return reflect.Value{}, fmt.Errorf("mainWindow.Invoke method not found (wails version may have changed)")
	}
	invokeType := invoke.Type()
	if invokeType.NumIn() != 1 || invokeType.In(0).Kind() != reflect.Func ||
		invokeType.In(0).NumIn() != 0 || invokeType.In(0).NumOut() != 0 ||
		invokeType.NumOut() > 1 || (invokeType.NumOut() == 1 && invokeType.Out(0).Kind() != reflect.Bool) {
		return reflect.Value{}, fmt.Errorf("mainWindow.Invoke signature changed: expected func(func()) or func(func()) bool, got %v", invokeType)
	}
	return invoke, nil
}

func safeCallPutZoomFactor(putZoomFactor reflect.Value, factor float64) (err error) {
	defer func() {
		if value := recover(); value != nil {
			err = fmt.Errorf("PutZoomFactor panicked while resetting WebView2 zoom factor: %v", value)
		}
	}()
	putZoomFactor.Call([]reflect.Value{reflect.ValueOf(factor)})
	return nil
}
