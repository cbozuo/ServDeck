//go:build windows

package app

import (
	"reflect"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// WebView2 边界幂等闸门。
//
// chromium.Resize() 的实现是 GetClientRect(主窗口) → controller.PutBounds，是一次
// 真实的 put_Bounds：Chromium 会把整个视口重新光栅。wails 内建 WM_SIZE 已经做过
// 完全相同的事（frontend.go 的 OnSize → resizeDebouncer → chromium.Resize()），
// 所以无条件追帧等于每次都多一次全页重排。叠加前端 resize 自激
// （frontend/src/utils/windowsWindowScaleRepair.ts 的 notifyResize 会
// dispatchEvent('resize') 再排一轮修复），肉眼就是连续闪烁。
//
// 这里在追帧前先比对：WebView2 渲染子窗口的客户区尺寸是否已等于主窗口客户区。
// 已一致就不追帧。探测失败则退化为旧的无条件追帧，保证不漏修。

var (
	boundsProbeUser32        = windows.NewLazySystemDLL("user32.dll")
	boundsProbeGetClientRect = boundsProbeUser32.NewProc("GetClientRect")
	boundsProbeEnumChild     = boundsProbeUser32.NewProc("EnumChildWindows")
	boundsProbeGetClassNameW = boundsProbeUser32.NewProc("GetClassNameW")
)

// webViewChildTolerance 允许 1 个逻辑像素的舍入误差：put_Bounds 与 GetClientRect
// 之间的 DPI 换算不保证整除，差 1px 就追帧等于没设闸门。
const webViewChildTolerance = 1

type probeRect struct {
	Left, Top, Right, Bottom int32
}

func probeClientRect(handle uintptr) (probeRect, bool) {
	if handle == 0 {
		return probeRect{}, false
	}
	var rect probeRect
	ret, _, _ := boundsProbeGetClientRect.Call(handle, uintptr(unsafe.Pointer(&rect)))
	if ret == 0 {
		return probeRect{}, false
	}
	return rect, true
}

func probeInt32Size(rect probeRect) (int64, int64) {
	return int64(rect.Right - rect.Left), int64(rect.Bottom - rect.Top)
}

// webViewBoundsAlreadySynced 报告 WebView2 渲染窗口是否已贴合主窗口客户区。
// 第二个返回值为 false 表示探测本身失败，调用方应退化为无条件追帧。
func webViewBoundsAlreadySynced(mainWindowValue, _ reflect.Value) (synced bool, probeOK bool) {
	mainHandle := probeMainWindowHandle(mainWindowValue)
	if mainHandle == 0 {
		return false, false
	}
	mainRect, ok := probeClientRect(mainHandle)
	if !ok {
		return false, false
	}
	webRect, ok := probeLargestWebViewChildRect(mainHandle)
	if !ok {
		return false, false
	}
	mainWidth, mainHeight := probeInt32Size(mainRect)
	webWidth, webHeight := probeInt32Size(webRect)
	if abs64(webWidth-mainWidth) > webViewChildTolerance || abs64(webHeight-mainHeight) > webViewChildTolerance {
		return false, true
	}
	return true, true
}

func abs64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}

func probeMainWindowHandle(mainWindowValue reflect.Value) uintptr {
	handle := mainWindowValue.MethodByName("Handle")
	if !handle.IsValid() || handle.Type().NumIn() != 0 || handle.Type().NumOut() != 1 {
		return 0
	}
	results := handle.Call(nil)
	if len(results) == 0 {
		return 0
	}
	handleValue, _ := results[0].Interface().(uintptr)
	return handleValue
}

// probeLargestWebViewChildRect 在主窗口子窗口中找出面积最大的 Chrome_WidgetWin_*，
// 即 WebView2 的渲染窗口。枚举顺序不保证，必须按面积取最大。
func probeLargestWebViewChildRect(parent uintptr) (probeRect, bool) {
	if parent == 0 {
		return probeRect{}, false
	}
	var (
		best     probeRect
		bestArea int64
		found    bool
	)
	callback := syscall.NewCallback(func(child uintptr, _ uintptr) uintptr {
		var buf [64]uint16
		length, _, _ := boundsProbeGetClassNameW.Call(child, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
		if length == 0 {
			return 1
		}
		if !strings.Contains(syscall.UTF16ToString(buf[:length]), "Chrome_WidgetWin") {
			return 1
		}
		rect, ok := probeClientRect(child)
		if !ok {
			return 1
		}
		width, height := probeInt32Size(rect)
		area := width * height
		if area > bestArea {
			bestArea = area
			best = rect
			found = true
		}
		return 1
	})
	boundsProbeEnumChild.Call(parent, callback, 0)
	return best, found
}
