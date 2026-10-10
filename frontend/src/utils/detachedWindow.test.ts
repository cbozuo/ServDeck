import { describe, expect, it } from 'vitest';
import {
  createDefaultDetachedBounds,
  DETACH_TAB_DRAG_Y_THRESHOLD,
  nextDetachedZIndex,
  resolveDetachedWindowTitle,
  resolveNativeDetachDragRelease,
  resolveNativeDetachPreferredBounds,
  resolveNativeDetachReleasePoint,
  shouldDetachAfterNativePointerCancel,
  shouldDetachTabByDrag,
  shouldDetachAtScreenPoint,
} from './detachedWindow';
import {
  APP_DETACHED_WINDOW_Z_INDEX_BASE,
  APP_POPUP_Z_INDEX,
} from './overlayZIndex';

describe('detachedWindow helpers', () => {
  it('computes next z-index above existing windows', () => {
    expect(nextDetachedZIndex([])).toBe(APP_DETACHED_WINDOW_Z_INDEX_BASE + 1);
    expect(nextDetachedZIndex([
      { zIndex: APP_DETACHED_WINDOW_Z_INDEX_BASE + 100 },
      { zIndex: APP_DETACHED_WINDOW_Z_INDEX_BASE + 50 },
    ])).toBe(APP_DETACHED_WINDOW_Z_INDEX_BASE + 101);
    expect(nextDetachedZIndex([])).toBeLessThan(APP_POPUP_Z_INDEX);
  });

  it('detaches only when vertical drag exceeds threshold', () => {
    expect(shouldDetachTabByDrag(DETACH_TAB_DRAG_Y_THRESHOLD - 1)).toBe(false);
    expect(shouldDetachTabByDrag(DETACH_TAB_DRAG_Y_THRESHOLD)).toBe(true);
    expect(shouldDetachTabByDrag(-DETACH_TAB_DRAG_Y_THRESHOLD)).toBe(true);
  });

  it('builds a default floating window bounds', () => {
    const bounds = createDefaultDetachedBounds([]);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.zIndex).toBeGreaterThan(APP_DETACHED_WINDOW_Z_INDEX_BASE);
    expect(bounds.zIndex).toBeLessThan(APP_POPUP_Z_INDEX);
  });

  it('resolves floating window titles with object labels', () => {
    expect(resolveDetachedWindowTitle({
      kindLabel: '表数据',
      objectLabel: 'users',
      fallbackTitle: 'users',
    })).toBe('表数据 · users');
    expect(resolveDetachedWindowTitle({
      kindLabel: 'SQL 查询',
      fallbackTitle: 'Query 1',
    })).toBe('Query 1');
  });

  it('keeps virtual-desktop coordinates when detaching to another display', () => {
    expect(resolveNativeDetachPreferredBounds(-1600, 120)).toEqual({ x: -1720, y: 96 });
    expect(resolveNativeDetachPreferredBounds(2200, 120)).toEqual({ x: 2080, y: 96 });
    expect(resolveNativeDetachPreferredBounds(600, -500)).toEqual({ x: 480, y: -524 });
  });

  it('resolves drag release in screen coordinates instead of WebView coordinates', () => {
    expect(resolveNativeDetachReleasePoint({
      startScreenX: 1320,
      startScreenY: 80,
      deltaX: 1100,
      deltaY: 60,
    })).toEqual({ screenX: 2420, screenY: 140 });
    expect(resolveNativeDetachReleasePoint({
      startScreenX: 40,
      startScreenY: 80,
      deltaX: -900,
      deltaY: -300,
    })).toEqual({ screenX: -860, screenY: -220 });
  });

  it('prefers the real terminal pointer on a negative-coordinate display', () => {
    expect(resolveNativeDetachDragRelease({
      startClientX: 800,
      startClientY: 40,
      startScreenX: 1800,
      startScreenY: 80,
      fallbackDeltaX: -300,
      fallbackDeltaY: 10,
      terminalPointer: {
        type: 'pointercancel',
        clientX: -120,
        clientY: 160,
        screenX: -1480,
        screenY: 220,
      },
    })).toEqual({
      deltaX: -920,
      deltaY: 120,
      screenX: -1480,
      screenY: 220,
      terminalType: 'pointercancel',
    });
  });

  it('detaches when the pointer leaves the host window in any screen direction', () => {
    const host = { x: 100, y: 80, width: 1200, height: 800 };
    expect(shouldDetachAtScreenPoint(80, 300, host)).toBe(true);
    expect(shouldDetachAtScreenPoint(1500, 300, host)).toBe(true);
    expect(shouldDetachAtScreenPoint(500, 40, host)).toBe(true);
    expect(shouldDetachAtScreenPoint(500, 1000, host)).toBe(true);
    expect(shouldDetachAtScreenPoint(600, 300, host)).toBe(false);
  });

  it('treats a native pointercancel outside the host as a completed detach drag', () => {
    const host = { x: 100, y: 80, width: 1200, height: 800 };
    expect(shouldDetachAfterNativePointerCancel({
      terminalType: 'pointercancel',
      deltaY: 12,
      screenX: -1480,
      screenY: 220,
    }, host)).toBe(true);
    expect(shouldDetachAfterNativePointerCancel({
      terminalType: 'pointerup',
      deltaY: 120,
      screenX: -1480,
      screenY: 220,
    }, host)).toBe(false);
  });

});
