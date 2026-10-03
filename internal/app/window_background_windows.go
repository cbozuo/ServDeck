//go:build windows

package app

import (
	"context"
	"fmt"
	"reflect"

	"golang.org/x/sys/windows"

	"GoNavi-Wails/internal/logger"
)

var windowBackgroundUser32 = windows.NewLazySystemDLL("user32.dll")
var windowBackgroundGdi32 = windows.NewLazySystemDLL("gdi32.dll")

var (
	windowBackgroundSetClassLongPtr = windowBackgroundUser32.NewProc("SetClassLongPtrW")
	windowBackgroundGetClassLongPtr = windowBackgroundUser32.NewProc("GetClassLongPtrW")
	windowBackgroundCreateSolidBrush = windowBackgroundGdi32.NewProc("CreateSolidBrush")
	windowBackgroundDeleteObject     = windowBackgroundGdi32.NewProc("DeleteObject")
)

const (
	// GCLP_HBRBACKGROUND 类背景刷索引：WM_ERASEBKGND 用它填充客户区——
	// frameless 窗口拖拽缩放时 ResizeDebounce 推迟 PutBounds 期间暴露的区域
	// 由该刷填充，颜色与应用底色一致才能避免刺眼白闪。
	windowBackgroundClassIndex = uintptr(^uintptr(9)) // GCLP_HBRBACKGROUND = -10
)

// COLORREF 是 0x00BBGGRR（与 #RRGGBB 字节序相反）。
func colorRefOf(r, g, b uint8) uintptr {
	return uintptr(r) | uintptr(g)<<8 | uintptr(b)<<16
}

// resolveMainWindowHandle 通过 wails ctx 反射解析主窗口 HWND，
// 供背景刷、过渡动画等窗口级 Win32/DWM 调用共用。
func resolveMainWindowHandle(ctx context.Context) (uintptr, error) {
	frontendValue, err := resolveWailsFrontendValue(ctx)
	if err != nil {
		return 0, err
	}
	mainWindowValue, err := accessibleWailsFrontendField(frontendValue, "mainWindow")
	if err != nil {
		return 0, err
	}

	handle := mainWindowValue.MethodByName("Handle")
	if !handle.IsValid() {
		return 0, fmt.Errorf("mainWindow.Handle method not found (wails version may have changed)")
	}
	if handle.Type().NumIn() != 0 || handle.Type().NumOut() != 1 || handle.Type().Out(0).Kind() != reflect.Uintptr {
		return 0, fmt.Errorf("mainWindow.Handle signature changed: expected func() uintptr, got %v", handle.Type())
	}

	hwndValue := handle.Call(nil)
	if len(hwndValue) == 0 {
		return 0, fmt.Errorf("mainWindow.Handle returned no value")
	}
	hwnd, _ := hwndValue[0].Interface().(uintptr)
	if hwnd == 0 {
		return 0, fmt.Errorf("mainWindow handle is zero")
	}
	return hwnd, nil
}

// setMainWindowBackgroundBrush 把主窗口类的背景刷换成应用底色。
// 拖拽缩放时 ResizeDebounce 推迟 PutBounds，新暴露区域由该刷擦色——
// 与界面底色一致才能避免白块闪烁；主题切换时由前端回调换深/浅刷。
func setMainWindowBackgroundBrush(ctx context.Context, dark bool) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("set window background brush panic: %v", recovered)
		}
	}()
	if ctx == nil {
		return fmt.Errorf("ctx is nil")
	}

	hwnd, err := resolveMainWindowHandle(ctx)
	if err != nil {
		return err
	}

	var r, g, b uint8
	if dark {
		r, g, b = 0x0c, 0x0e, 0x12 // 暗色底 rgb(12 14 18)，与 v2-theme --gn-bg-app-opaque 一致
	} else {
		r, g, b = 0xf6, 0xf6, 0xf4 // 亮色底 rgb(246 246 244)，与 v2-theme --gn-bg-app-opaque 一致
	}
	// GCLP_HBRBACKGROUND 需要的是 CreateSolidBrush 返回的真实 HBRUSH 句柄：
	// 直接把 COLORREF 当句柄传是无效值，WM_ERASEBKGND 的填充会静默失败，
	// 暴露区域不被擦除（残影/白垃圾）——正是整页闪烁的来源。
	colorRef := colorRefOf(r, g, b)
	brush, _, callErr := windowBackgroundCreateSolidBrush.Call(colorRef)
	if brush == 0 {
		return fmt.Errorf("CreateSolidBrush(0x%08x) failed: %v", colorRef, callErr)
	}
	oldBrush, _, _ := windowBackgroundSetClassLongPtr.Call(hwnd, windowBackgroundClassIndex, brush)
	// 旧刷是本进程 CreateSolidBrush 的产物（Wails 官方启动路径或上次调用），删除防 GDI 泄漏；
	// stock 刷不可删除，调用失败无害。
	if oldBrush != 0 {
		windowBackgroundDeleteObject.Call(oldBrush)
	}
	readBack, _, _ := windowBackgroundGetClassLongPtr.Call(hwnd, windowBackgroundClassIndex)
	logger.Infof("主窗口背景刷：dark=%v color=#%02x%02x%02x brush=0x%x old=0x%x readback=0x%x", dark, r, g, b, brush, oldBrush, readBack)
	if readBack != brush {
		logger.Warnf("背景刷读回不一致：set=0x%x readback=0x%x", brush, readBack)
	}
	syncWebViewDefaultBackground(ctx, r, g, b)
	return nil
}

// syncWebViewDefaultBackground 把 WebView2 的 DefaultBackgroundColor 同步为主题底色。
// put_Bounds 扩大 WebView 边界后，渲染器产出新帧前的 1-2 帧里新增区域由该色
// 填充（默认白）——与内容底色的色差在最大化/还原时表现为整页"抖一下"。
// PutDefaultBackgroundColor 是 COM 调用，只能在创建 Controller 的主线程执行，
// 因此经 mainWindow.Invoke 调度；反射失败只降级为不跟随主题，不影响背景刷本身。
func syncWebViewDefaultBackground(ctx context.Context, r, g, b uint8) {
	defer func() {
		if recovered := recover(); recovered != nil {
			logger.Warnf("同步 WebView2 默认背景色失败：%v", recovered)
		}
	}()
	frontendValue, err := resolveWailsFrontendValue(ctx)
	if err != nil {
		return
	}
	chromiumValue, err := accessibleWailsFrontendField(frontendValue, "chromium")
	if err != nil {
		return
	}
	mainWindowValue, err := accessibleWailsFrontendField(frontendValue, "mainWindow")
	if err != nil {
		return
	}
	invoke, err := resolveMainWindowInvoke(mainWindowValue)
	if err != nil {
		logger.Warnf("解析 mainWindow.Invoke 失败，跳过 WebView2 默认背景色同步：%v", err)
		return
	}
	setBackground := chromiumValue.MethodByName("SetBackgroundColour")
	if !setBackground.IsValid() {
		return
	}
	invoke.Call([]reflect.Value{reflect.ValueOf(func() {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Warnf("WebView2 默认背景色同步执行失败：%v", recovered)
			}
		}()
		setBackground.Call([]reflect.Value{
			reflect.ValueOf(r),
			reflect.ValueOf(g),
			reflect.ValueOf(b),
			reflect.ValueOf(uint8(255)),
		})
	})})
}
