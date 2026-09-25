# 窗口「扩大再缩小」闪烁成因诊断（未改任何代码）

诊断日期：2026-09-25
范围：`main.go`、`internal/app/window_*_windows.go`、`frontend/src/App.tsx`、`frontend/src/utils/window*`
依赖版本：Wails v2.15.0、go-webview2 v1.0.22（本机 module cache）

---

## 1. 结论速览

闪烁不是单一 bug，是四层叠加。**主因在宿主层的 resize 路径**，`App.tsx` 里的大量「窗口修复」反过来把它放大。

| 层 | 位置 | 机制 | 确定性 |
|---|---|---|---|
| A 主因 | Wails `frontend.go:209-217` + go-webview2 `chromium.go:242-254` | 每个 `WM_SIZE` 同步触发 `GetClientRect` → `PutBounds`，无防抖 | 源码确证 |
| B 显色 | `main.go:376-389` + `App.css:14-28` | Windows 分支背景色恒为纯白 `RGBA(255,255,255,255)`、`WebviewIsTransparent=false` | 源码确证 |
| C 放大器 | `App.tsx:2191-2207`、`2464-2479`、`windowsWindowScaleRepair.ts:24-46` | resize → 80/240ms 后 `WindowSetSize` / `PutZoomFactor(1.0)` / `RefreshWebViewBounds` → 再 `dispatchEvent(resize)`，形成回环 | 源码确证 |
| D 启动加剧 | `App.tsx:1657-1884` | 最多 8 次重试，含 `Unmaximise → Maximise → Unmaximise` 往返 | 源码确证 |

---

## 2. 主因 A：WM_SIZE 直连 PutBounds，没有防抖

`internal/frontend/desktop/windows/frontend.go`

```go
// 103-105
if appoptions.Windows.ResizeDebounceMS > 0 {
    result.resizeDebouncer = debounce.New(time.Duration(appoptions.Windows.ResizeDebounceMS) * time.Millisecond)
}

// 209-217
if f.resizeDebouncer != nil {
    f.resizeDebouncer(func() { f.mainWindow.Invoke(func() { f.chromium.Resize() }) })
} else {
    f.chromium.Resize()   // ← 项目走这条
}
```

`main.go:381-388` 的 `windows.Options` 只设了 6 个字段，**没有 `ResizeDebounceMS`** ⇒ `resizeDebouncer == nil` ⇒ 走 else 分支。

`chromium.Resize()` 的代价（`go-webview2@v1.0.22/pkg/edge/chromium.go:247-253`）：

```
GetClientRect(hwnd)  →  controller.PutBounds(newBounds)
```

`PutBounds` 是异步跨进程合成。拖边框时窗口 HWND 每帧已经到新几何，WebView2 控制器还停在上一帧 bounds，合成结果先被拉伸填补，下一帧才追上。这个「追帧」就是肉眼看到的抖动。

项目自己的注释已经承认这条路径会落后（`internal/app/window_bounds_windows.go:14-16`）：

> Wails normally does this from WM_SIZE, but a late startup maximise can expose WS_MAXIMIZE **before that resize reaches the WebView surface**.

## 3. 显色 B：为什么是「闪白」而不是拉丝

```go
// main.go:379
disableTransparency := lowMemoryMode || strings.EqualFold(goos, "windows")
// => RGBA{255,255,255,255}, WebviewIsTransparent=false, BackdropType=None
```

`App.css:14-28` 的注释把后果写得很清楚：

> Windows uses an opaque HWND. Transparent pixels here fall through to the **native white client area** and look like a blank window, including the gap while React hydrates and **around an undersized WebView2 controller**.

深色主题（`--gn-bg-app: rgb(12 14 18 / 1)`）与纯白底色的对比度接近最大值。A 造成的任何一帧滞后空白，都会被放大成明显的白色闪跳。

## 4. 放大器 C：resize 后的自我回归链条

三条独立触发，最终都回到 `window.dispatchEvent(new Event('resize'))`：

| 触发源 | 延迟 | 副作用 |
|---|---|---|
| `installNativeWindowActivityScheduler.resize` → `scheduleWindowBoundsRepair` | 80ms | 若 `resolveRuntimeWindowPlacement` 结果与当前不符 → `WindowSetSize` + `WindowSetPosition` + `setWindowBounds` + `dispatch(resize)` |
| `handleWindowResize` → `scheduleDevicePixelRatioCheck('resize')` | 240ms | `devicePixelRatio` 差 >0.02 → `PutZoomFactor(1.0)` + `RefreshWebViewBounds` + `dispatch(resize)` |
| `installNativeWindowActivityScheduler.resize` → `scheduleWindowStateSave` | 260ms | `WindowIsFullscreen/IsMaximised/GetSize/GetPosition` 四次 IPC，命中则 `setWindowBounds` |

两个高危点：

1. **`PutZoomFactor(1.0)`（`window_zoom_windows.go:33`）**：重设 zoom factor 会让整个页面重新光栅化。即使成功，视觉上也是一次全屏「清屏再补」。
2. **`dispatch(new Event('resize'))` 被当作回调手段**（`App.tsx:1706`、`2185`、`2337`）：它重新喂进上述三个监听，理论上第二次因 bounds 一致而 return，但 debounce 只有 80ms，用户松手后 WebView2 仍在持续发原生 resize，两边会互相追赶。

`manualResetWindowZoom` 兜底路径（`App.tsx:5184-5186`）还保留着 ±1px nudge：

```ts
WindowSetSize(getWindowsScaleFixNudgedWidth(width), height);  // width-1
await sleep(28);
WindowSetSize(width, height);                                  // 再还原
```

这是显式的两帧抖动，只由 Ctrl+Shift+0 触发，不在常规 resize 路径上。

## 5. 验证方法（无需改代码）

1. `wails dev` 起开发版 → F12 → Rendering → 勾 **Paint flashing**。拖窗口边缘，若整屏常绿，说明是合成层整体重绘（指向 A / zoom reset），局部条带则是指 BPutBounds 滞后。
2. 控制台过滤 `warn`。出现 `RefreshWebViewBounds unavailable in scale repair` 或 `ResetWebViewZoom unavailable in fixWindowScaleIfNeeded` 说明自动修复被触发且未成功，会在每次 resize 后再重试。
3. 同一显示器、同一系统缩放（100%）下拖动边框若不闪，跨到 125% 缩放的屏或改系统缩放后闪，直接坐实 C 的 `PutZoomFactor` 分支。
4. PowerShell 确认多屏缩放是否一致：
   `Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorListedSupportedSourceModes`

## 6. 修复方向（按性价比排序，本次未实施）

| 优先级 | 改动 | 预期收益 | 代价 |
|---|---|---|---|
| P0 | `main.go:381` 的 `windows.Options` 增加 `ResizeDebounceMS: 100` | Wails 内置 debounce 接管 WM_SIZE，直接消抖 | 一行。resize 跟手感略降 100ms |
| P0 | 给 `App.tsx` 的 `dispatch(new Event('resize'))` 三处改成 rAF 节流 + 去重 | 切断自激回环 | 小，需补 3 处测试期望 |
| P1 | `BackgroundColour` 跟随主题（启动读 persisted theme），至少深色主题用 `#14161a` | 把白闪降级为同色炫光 | 需处理 hydration 前的时序 |
| P1 | `checkDevicePixelRatio` 阈值从 0.02 放宽 + 增加「同一 ratio 只修一次」记忆 | 避免反复 zoom reset | 需评估 isMinimised/hidden 路径 |
| P2 | 移除 `getWindowsScaleFixNudgedWidth` 的 ±1px 往返 | 消除显式两帧抖动 | 该兜底可能是为老版 WebView2 保留，需确认 |

## 7. 排除项

- CSS `100vw` / 滚动条抖动：`html, body, #root` 已 `overflow: hidden`（`App.css:10`），且只有 modal 用 `max-width: calc(100vw - N)`，不构成根布局抖动。
- 侧边栏 Sider `transition: all`：`App.css:4188-4194` 已用 `[data-sidebar-resizing='true'] transition: none !important` 关掉，且只在拖拽侧栏宽度时生效。
- DWM / Acrylic 透明：`Windows` 分支明确 `BackdropType: windows.None`，未启用系统亚克力，不参与症状。
- 窗口圆角：`--gonavi-border-radius` 在 maximize/normal 间切 14px ↔ 0px（`App.tsx:1262-1269`），会有一帧重绘，属静态瑕疵，与 resize 抖动是两回事。
