import { WindowGetSize, WindowIsFullscreen } from '../../wailsjs/runtime';
import { safeWindowRuntimeCall } from './wailsRuntime';
import { hasWindowsViewportScaleDrift } from './windowsScaleFix';
import {
  shouldApplyWindowsScaleFix, shouldResetWebViewZoomForScaleFix,
  type WindowScaleFixReason,
} from './windowStateUi';

type WindowScaleRepairOptions = {
  reason: WindowScaleFixReason;
  readViewport: () => { innerWidth: number; devicePixelRatio: number; visualViewportScale?: number };
  resetZoom: () => Promise<boolean>;
  refreshBounds: () => Promise<boolean>;
  notifyResize: () => void;
  isCancelled: () => boolean;
};

/**
 * Automatic repair only touches the WebView controller. A SetSize nudge based on
 * a normal-window snapshot can resume after startup/user maximisation. Wails
 * MoveWindow then shrinks the outer HWND without clearing WS_MAXIMIZE, while its
 * client rect still fills the monitor: the right/bottom of the app is clipped.
 */
export const repairWindowsWindowScale = async (options: WindowScaleRepairOptions): Promise<void> => {
  const { reason, resetZoom, refreshBounds, notifyResize, isCancelled } = options;
  if (isCancelled()) return;
  const isFullscreen = await safeWindowRuntimeCall(() => WindowIsFullscreen(), false);
  if (isCancelled()) return;
  if (isFullscreen) {
    notifyResize();
    return;
  }
  const size = await safeWindowRuntimeCall(() => WindowGetSize(), null);
  if (isCancelled()) return;
  const width = Math.trunc(Number(size?.w || 0));
  const drift = hasWindowsViewportScaleDrift({ windowWidth: width, ...options.readViewport() });
  if (shouldApplyWindowsScaleFix(reason, drift)) {
    if (shouldResetWebViewZoomForScaleFix(reason, drift)) {
      await safeWindowRuntimeCall(resetZoom, false);
      if (isCancelled()) return;
    }
    await safeWindowRuntimeCall(refreshBounds, false);
    if (isCancelled()) return;
    // 只有真的动过 WebView 才通知 resize。refreshBounds 现在是幂等的
    // （边界已贴合时 Go 侧直接返回，不做 put_Bounds），但 notifyResize 派发的
    // resize 事件会重新排一轮 bounds 校正与 state 保存；无条件派发等于
    // 自己喂自己，700ms 节流只能压到 1.4Hz 的持续抖动。
    notifyResize();
  }
};
