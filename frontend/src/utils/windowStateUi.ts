export type WindowVisualState = 'normal' | 'maximized' | 'fullscreen';
export type WindowScaleFixReason = 'activation' | 'ratio-change' | 'restore' | 'startup';
export type WindowsScaleCheckTrigger = 'focus' | 'pageshow' | 'poll' | 'resize' | 'visibilitychange';
export type TitleBarToggleIconKey = 'maximize' | 'restore';

// resize/focus/pageshow/visibility 生命周期事件承担实时同步；轮询只作为 Wails
// 未上报“仅移动窗口”等边缘场景的低频容错，避免空闲窗口持续跨 JS/Go 边界。
export const WINDOW_STATE_FALLBACK_INTERVAL_MS = 15_000;
export const WINDOWS_SCALE_FALLBACK_INTERVAL_MS = 10_000;

type NativeWindowActivityEventHandler = () => void;

export interface NativeWindowActivitySchedulerHandlers {
  resize?: NativeWindowActivityEventHandler;
  focus?: NativeWindowActivityEventHandler;
  blur?: NativeWindowActivityEventHandler;
  pageshow?: NativeWindowActivityEventHandler;
  pagehide?: NativeWindowActivityEventHandler;
  beforeunload?: NativeWindowActivityEventHandler;
  visibilitychange?: NativeWindowActivityEventHandler;
}

export interface NativeWindowActivitySchedulerOptions {
  windowTarget: Window;
  documentTarget: Document;
  fallbackIntervalMs: number;
  onFallback: NativeWindowActivityEventHandler;
  handlers: NativeWindowActivitySchedulerHandlers;
}

export const installNativeWindowActivityScheduler = ({
  windowTarget,
  documentTarget,
  fallbackIntervalMs,
  onFallback,
  handlers,
}: NativeWindowActivitySchedulerOptions): (() => void) => {
  const windowListeners: Array<{
    type: keyof Pick<WindowEventMap, 'resize' | 'focus' | 'blur' | 'pageshow' | 'pagehide' | 'beforeunload'>;
    listener: EventListener;
    capture: boolean;
  }> = [];

  const addWindowListener = (
    type: keyof Pick<WindowEventMap, 'resize' | 'focus' | 'blur' | 'pageshow' | 'pagehide' | 'beforeunload'>,
    handler: NativeWindowActivityEventHandler | undefined,
    capture = false,
  ) => {
    if (!handler) return;
    const listener: EventListener = () => handler();
    windowTarget.addEventListener(type, listener, capture);
    windowListeners.push({ type, listener, capture });
  };

  addWindowListener('resize', handlers.resize);
  addWindowListener('focus', handlers.focus);
  addWindowListener('blur', handlers.blur);
  addWindowListener('pageshow', handlers.pageshow);
  addWindowListener('pagehide', handlers.pagehide, true);
  addWindowListener('beforeunload', handlers.beforeunload, true);

  let fallbackTimer: number | null = null;
  const stopFallback = () => {
    if (fallbackTimer === null) return;
    windowTarget.clearInterval(fallbackTimer);
    fallbackTimer = null;
  };
  const startFallback = () => {
    if (fallbackTimer !== null || documentTarget.visibilityState !== 'visible') return;
    fallbackTimer = windowTarget.setInterval(() => {
      if (documentTarget.visibilityState === 'visible') {
        onFallback();
      }
    }, fallbackIntervalMs);
  };
  const visibilityListener: EventListener = () => {
    if (documentTarget.visibilityState === 'visible') {
      startFallback();
    } else {
      stopFallback();
    }
    handlers.visibilitychange?.();
  };
  documentTarget.addEventListener('visibilitychange', visibilityListener);
  startFallback();

  return () => {
    stopFallback();
    for (const { type, listener, capture } of windowListeners) {
      windowTarget.removeEventListener(type, listener, capture);
    }
    documentTarget.removeEventListener('visibilitychange', visibilityListener);
  };
};

export const shouldApplyWindowsScaleFix = (
  reason: WindowScaleFixReason,
  hasViewportScaleDrift: boolean,
): boolean => (
  reason === 'restore'
  // startup 必须有真实漂移才修：无条件放行会让启动后 1s/1.9s 的定时器
  // 各执行一次 ResetWebViewZoom + PutBounds（整页 reflow），窗口显示后
  // 用户看到"整个界面刷新了一下"。漂移检测（窗口宽/视口宽比值 + 8% 容差）
  // 已能覆盖"冷启动 WebView 只铺一角"的原始 bug 场景。
  || (reason === 'startup' && hasViewportScaleDrift)
  || (reason === 'ratio-change' && hasViewportScaleDrift)
);

// Automatic repairs reset the controller and refresh its bounds without changing
// native geometry; stale SetSize calls can shrink an already-maximised HWND.
export const shouldResetWebViewZoomForScaleFix = (
  reason: WindowScaleFixReason,
  hasViewportScaleDrift: boolean,
): boolean => {
  if (reason === 'restore') {
    // 任务栏恢复的日常场景（单屏、DPI 未变）不得整页 zoom 重置：
    // ResetWebViewZoom 是整页 reflow，用户感知为恢复后约 1 秒"整个界面刷新"。
    // 真实漂移（换屏/DPI 变化）仍执行；bounds 刷新（PutBounds，无感）由
    // shouldApplyWindowsScaleFix 对 restore 无条件保留，旧 surface 场景不回归。
    return hasViewportScaleDrift;
  }
  return shouldApplyWindowsScaleFix(reason, hasViewportScaleDrift);
};

export const resolveWindowsScaleCheckDelayMs = (trigger: WindowsScaleCheckTrigger): number =>
  trigger === 'resize' ? 240 : 0;

/** 拖拽缩放窗口时的防闪标记：resize 活跃期间在 html/body 挂
 *  data-window-resizing，静默 160ms 后移除——CSS 据此临时切不透明底色并禁过渡，
 *  消除半透明缝隙透白与样式过渡闪烁。色值必须用主题 --gn-bg-app-opaque，
 *  硬编码色值会在挂/摘时产生冷暖色偏（整页"咯噔"）。
 *  注意：不要在这里做 RefreshWebViewBounds 之类的追帧——wails 内建 Resize
 *  已在 WM_SIZE 同步执行，追加调用是冗余的第二次 PutBounds（会加重抖动）。 */
export const WINDOW_RESIZE_QUIET_MS = 160;

export const installWindowResizeActivityMarker = ({
  windowTarget,
  documentTarget,
}: {
  windowTarget: Window;
  documentTarget: Document;
}): (() => void) => {
  let quietTimer = 0;
  let active = false;

  const setActive = (next: boolean) => {
    if (active === next) return;
    active = next;
    // html/body 都挂：CSS 直接用 html[data-window-resizing] 选择（:has 在 WebView2 不可靠）
    const root = documentTarget.documentElement;
    if (next) {
      root?.setAttribute('data-window-resizing', 'true');
      documentTarget.body?.setAttribute('data-window-resizing', 'true');
    } else {
      root?.removeAttribute('data-window-resizing');
      documentTarget.body?.removeAttribute('data-window-resizing');
    }
  };

  const listener = () => {
    setActive(true);
    if (quietTimer) windowTarget.clearTimeout(quietTimer);
    quietTimer = windowTarget.setTimeout(() => setActive(false), WINDOW_RESIZE_QUIET_MS);
  };

  windowTarget.addEventListener('resize', listener);
  return () => {
    windowTarget.removeEventListener('resize', listener);
    if (quietTimer) windowTarget.clearTimeout(quietTimer);
    setActive(false);
  };
};

/** 最大化快速标记：resize 事件里同步比对视口与工作区尺寸，立即挂/摘
 *  data-window-maximized——圆角/裁剪（--gonavi-border-radius）据此同帧切换，
 *  比等 JS 轮询 WindowIsMaximised（IPC 往返 27-100ms）快一个量级，消除
 *  窗口几何瞬变后边缘形态二次变化的抖动感。权威 windowState（标题栏图标等）
 *  仍由轮询链路（syncWindowStateFromRuntime）维护，两条链最终一致。 */
export const installWindowMaximizedFastMarker = ({
  windowTarget,
  documentTarget,
}: {
  windowTarget: Window;
  documentTarget: Document;
}): (() => void) => {
  const apply = () => {
    const availWidth = windowTarget.screen?.availWidth || 0;
    const availHeight = windowTarget.screen?.availHeight || 0;
    if (availWidth <= 0 || availHeight <= 0) return;
    const maximized = windowTarget.innerWidth >= availWidth - 2
      && windowTarget.innerHeight >= availHeight - 2;
    const root = documentTarget.documentElement;
    if (maximized) {
      root?.setAttribute('data-window-maximized', 'true');
      documentTarget.body?.setAttribute('data-window-maximized', 'true');
    } else {
      root?.removeAttribute('data-window-maximized');
      documentTarget.body?.removeAttribute('data-window-maximized');
    }
  };
  apply();
  windowTarget.addEventListener('resize', apply);
  return () => {
    windowTarget.removeEventListener('resize', apply);
    documentTarget.documentElement?.removeAttribute('data-window-maximized');
    documentTarget.body?.removeAttribute('data-window-maximized');
  };
};

export const resolveTitleBarToggleIconKey = (windowState: WindowVisualState): TitleBarToggleIconKey =>
  windowState === 'maximized' ? 'restore' : 'maximize';
