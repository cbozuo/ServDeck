import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as runtime from '../../wailsjs/runtime';
import { repairWindowsWindowScale } from './windowsWindowScaleRepair';

vi.mock('../../wailsjs/runtime', () => ({
  WindowGetSize: vi.fn(), WindowIsFullscreen: vi.fn(), WindowIsMaximised: vi.fn(),
  WindowMaximise: vi.fn(), WindowUnmaximise: vi.fn(), WindowSetSize: vi.fn(),
}));

describe('Windows automatic surface repair', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(runtime.WindowIsFullscreen).mockResolvedValue(false);
    vi.mocked(runtime.WindowIsMaximised).mockResolvedValue(false);
    vi.mocked(runtime.WindowGetSize).mockResolvedValue({ w: 1440, h: 900 });
  });

  const createOptions = () => ({
    reason: 'startup' as const,
    readViewport: () => ({ innerWidth: 1440, devicePixelRatio: 1 }),
    resetZoom: vi.fn(async () => true),
    refreshBounds: vi.fn(async () => true),
    notifyResize: vi.fn(),
    isCancelled: () => false,
  });

  it.each(['startup', 'restore'] as const)(
    'does not shrink a maximised window when %s zoom repair started in normal state',
    async (reason) => {
      const native = { maximised: false, width: 1440, height: 900 };
      vi.mocked(runtime.WindowIsMaximised).mockImplementation(async () => native.maximised);
      vi.mocked(runtime.WindowSetSize).mockImplementation((w, h) => {
        // Wails MoveWindow changes the outer rect without clearing WS_MAXIMIZE.
        native.width = w;
        native.height = h;
      });
      let releaseZoom!: () => void;
      let zoomStarted!: () => void;
      const zoomPending = new Promise<void>((resolve) => { releaseZoom = resolve; });
      const zoomEntered = new Promise<void>((resolve) => { zoomStarted = resolve; });
      const options = createOptions();
      // startup 无漂移不再执行修复、restore 无漂移不再 zoom 重置（都会让
      // resetZoom 永不进入）；构造漂移（窗口 1440 逻辑宽 vs 视口 1000 →
      // ratio 1.44）使修复链执行，保留用例的防收缩保护意图。
      options.readViewport = () => ({ innerWidth: 1000, devicePixelRatio: 1 });
      options.resetZoom = vi.fn(async () => { zoomStarted(); await zoomPending; return true; });
      const repair = repairWindowsWindowScale({ ...options, reason });
      await zoomEntered;
      Object.assign(native, { maximised: true, width: 1920, height: 1050 });
      releaseZoom();
      await repair;
      expect(native).toEqual({ maximised: true, width: 1920, height: 1050 });
      expect(runtime.WindowSetSize).not.toHaveBeenCalled();
      expect(options.refreshBounds).toHaveBeenCalledOnce();
    },
  );

  it('refreshes controller bounds even when zoom reset is unavailable', async () => {
    const options = createOptions();
    // startup 需要真实漂移才执行（见 shouldApplyWindowsScaleFix 注释）。
    options.readViewport = () => ({ innerWidth: 1000, devicePixelRatio: 1 });
    options.resetZoom.mockRejectedValue(new Error('backend unavailable'));
    await repairWindowsWindowScale(options);
    expect(options.refreshBounds).toHaveBeenCalledOnce();
    expect(options.notifyResize).toHaveBeenCalledOnce();
    expect(runtime.WindowSetSize).not.toHaveBeenCalled();
  });

  it('stops after an awaited zoom reset when the effect is disposed', async () => {
    let cancelled = false;
    const options = createOptions();
    // startup 需要真实漂移才执行（见 shouldApplyWindowsScaleFix 注释）。
    options.readViewport = () => ({ innerWidth: 1000, devicePixelRatio: 1 });
    options.resetZoom.mockImplementation(async () => { cancelled = true; return true; });
    await repairWindowsWindowScale({ ...options, isCancelled: () => cancelled });
    expect(options.refreshBounds).not.toHaveBeenCalled();
    expect(options.notifyResize).not.toHaveBeenCalled();
  });

  it('repairs DPI drift without toggling or resizing the native window', async () => {
    const options = createOptions();
    await repairWindowsWindowScale({
      ...options,
      reason: 'ratio-change',
      readViewport: () => ({ innerWidth: 1000, devicePixelRatio: 1.5 }),
    });
    expect(options.resetZoom).toHaveBeenCalledOnce();
    expect(options.refreshBounds).toHaveBeenCalledOnce();
    expect(runtime.WindowSetSize).not.toHaveBeenCalled();
    expect(runtime.WindowUnmaximise).not.toHaveBeenCalled();
    expect(runtime.WindowMaximise).not.toHaveBeenCalled();
  });

  it.each(['activation', 'ratio-change'] as const)('leaves a healthy 150%% DPI window alone on %s', async (reason) => {
    const options = createOptions();
    await repairWindowsWindowScale({
      ...options,
      reason,
      readViewport: () => ({ innerWidth: 1440, devicePixelRatio: 1.5 }),
    });
    expect(options.resetZoom).not.toHaveBeenCalled();
    expect(options.refreshBounds).not.toHaveBeenCalled();
  });

  it('preserves fullscreen without controller or geometry mutations', async () => {
    vi.mocked(runtime.WindowIsFullscreen).mockResolvedValue(true);
    const options = createOptions();
    await repairWindowsWindowScale(options);
    expect(options.resetZoom).not.toHaveBeenCalled();
    expect(options.refreshBounds).not.toHaveBeenCalled();
    expect(options.notifyResize).toHaveBeenCalledOnce();
  });

  // notifyResize 派发的 resize 事件会重新排一轮 bounds 校正与 state 保存。
  // 无条件派发就是自己喂自己：700ms 节流只能把自激压成 1.4Hz 的持续抖动，
  // 肉眼仍是连续闪烁。所以只有真的动过 WebView 才允许通知。
  it.each(['activation', 'ratio-change'] as const)(
    'does not notify resize on %s when nothing was repaired',
    async (reason) => {
      const options = createOptions();
      await repairWindowsWindowScale({
        ...options,
        reason,
        readViewport: () => ({ innerWidth: 1440, devicePixelRatio: 1.5 }),
      });
      expect(options.refreshBounds).not.toHaveBeenCalled();
      expect(options.notifyResize).not.toHaveBeenCalled();
    },
  );

  it('notifies resize after a real bounds refresh so listeners resync once', async () => {
    const options = createOptions();
    // 构造漂移（窗口 1440 逻辑宽 vs 视口 1000 → ratio 1.44）迫使修复链执行。
    await repairWindowsWindowScale({
      ...options,
      reason: 'startup',
      readViewport: () => ({ innerWidth: 1000, devicePixelRatio: 1 }),
    });
    expect(options.refreshBounds).toHaveBeenCalledOnce();
    expect(options.notifyResize).toHaveBeenCalledOnce();
  });
});
