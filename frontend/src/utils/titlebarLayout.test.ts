import { describe, expect, it } from 'vitest';

import {
  normalizeTitlebarRuntimePlatform,
  resolveDockedTitleBarBandOffset,
  resolveDocumentPlatform,
  resolveTitleBarLayout,
  resolveTitlebarRuntimePlatform,
  shouldDockCollapsedSidebarActionsInTitlebar,
} from './titlebarLayout';

describe('titlebarLayout', () => {
  describe('normalizeTitlebarRuntimePlatform', () => {
    it.each([
      [' Darwin ', 'darwin'],
      ['macOS', 'darwin'],
      ['WIN32', 'windows'],
      ['linux', 'linux'],
      ['freebsd', 'freebsd'],
      ['', ''],
    ])('normalizes %s to %s', (runtimePlatform, expected) => {
      expect(normalizeTitlebarRuntimePlatform(runtimePlatform)).toBe(expected);
    });
  });

  describe('resolveTitlebarRuntimePlatform', () => {
    it.each([
      ['darwin', '', 'darwin'],
      [' Darwin ', '', 'darwin'],
      ['macOS', 'Windows', 'darwin'],
      ['windows', '', 'windows'],
      [' WIN32 ', 'MacIntel', 'windows'],
    ])('prefers a recognized runtime platform (%s)', (runtimePlatform, navigatorPlatform, expected) => {
      expect(resolveTitlebarRuntimePlatform(runtimePlatform, navigatorPlatform)).toBe(expected);
    });

    it.each([
      ['Darwin', 'darwin'],
      ['MacIntel', 'darwin'],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 'darwin'],
      ['Windows', 'windows'],
      ['Win32', 'windows'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows'],
    ])('recognizes explicit browser platform data (%s)', (navigatorPlatform, expected) => {
      expect(resolveTitlebarRuntimePlatform('', navigatorPlatform)).toBe(expected);
    });

    it('does not fall back to browser data when runtime reports another platform', () => {
      expect(resolveTitlebarRuntimePlatform('linux', 'MacIntel')).toBeNull();
    });
  });

  describe('resolveDocumentPlatform', () => {
    it.each([
      ['macOS', 'Windows', 'darwin'],
      [' WIN32 ', 'MacIntel', 'windows'],
      ['linux', 'MacIntel', 'linux'],
      ['FreeBSD', 'MacIntel', 'freebsd'],
    ])('keeps a reported runtime platform authoritative (%s)', (runtimePlatform, navigatorPlatform, expected) => {
      expect(resolveDocumentPlatform(runtimePlatform, navigatorPlatform)).toBe(expected);
    });

    it.each([
      ['', 'MacIntel', 'darwin'],
      ['', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows'],
      ['', 'Mozilla/5.0 (X11; Linux x86_64)', 'linux'],
      ['', 'Android', ''],
      ['', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', ''],
    ])('uses a canonical browser fallback before runtime bootstrap (%s / %s)', (runtimePlatform, navigatorPlatform, expected) => {
      expect(resolveDocumentPlatform(runtimePlatform, navigatorPlatform)).toBe(expected);
    });
  });

  describe('shouldDockCollapsedSidebarActionsInTitlebar', () => {
    it.each([
      ['darwin', ''],
      ['windows', ''],
      [' Darwin ', ''],
      [' WINDOWS ', ''],
    ])('docks V2 actions for runtime platform %s', (runtimePlatform, navigatorPlatform) => {
      expect(shouldDockCollapsedSidebarActionsInTitlebar(runtimePlatform, navigatorPlatform)).toBe(true);
    });

    it.each([
      ['', 'MacIntel'],
      ['', 'Win32'],
      ['', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)'],
      ['', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'],
    ])('uses navigator platform fallback %s / %s', (runtimePlatform, navigatorPlatform) => {
      expect(shouldDockCollapsedSidebarActionsInTitlebar(runtimePlatform, navigatorPlatform)).toBe(true);
    });

    it.each([
      ['linux', 'MacIntel'],
      ['linux', 'Win32'],
      ['freebsd', 'MacIntel'],
      ['android', 'Win32'],
      ['', 'Linux x86_64'],
      ['', 'Android'],
    ])('does not dock unsupported platform %s / %s', (runtimePlatform, navigatorPlatform) => {
      expect(shouldDockCollapsedSidebarActionsInTitlebar(runtimePlatform, navigatorPlatform)).toBe(false);
    });

    it('does not dock browser-hosted V2 actions even when the browser is Windows or macOS', () => {
      expect(shouldDockCollapsedSidebarActionsInTitlebar('windows', '', true)).toBe(false);
      expect(shouldDockCollapsedSidebarActionsInTitlebar('', 'MacIntel', true)).toBe(false);
    });
  });

  it('uses the larger default V2 titlebar while the explorer is expanded', () => {
    expect(resolveTitleBarLayout(1)).toEqual({
      height: 48,
      actionHeight: 30,
      dividerHeight: 16,
      upperBandHeight: 48,
      emptyWorkbenchTopOffset: 0,
    });
  });

  it('keeps the expanded V2 layout responsive to the configured UI scale', () => {
    expect(resolveTitleBarLayout(0.8, false)).toEqual({
      height: 38,
      actionHeight: 24,
      dividerHeight: 13,
      upperBandHeight: 38,
      emptyWorkbenchTopOffset: 0,
    });
    expect(resolveTitleBarLayout(1.25, false)).toEqual({
      height: 60,
      actionHeight: 38,
      dividerHeight: 20,
      upperBandHeight: 60,
      emptyWorkbenchTopOffset: 0,
    });
    expect(resolveTitleBarLayout(1.1, false)).toEqual({
      height: 53,
      actionHeight: 33,
      dividerHeight: 18,
      upperBandHeight: 53,
      emptyWorkbenchTopOffset: 0,
    });
  });

  it('keeps the taller V2 titlebar only while collapsed actions are docked into it', () => {
    expect(resolveTitleBarLayout(1, true)).toEqual({
      height: 59,
      actionHeight: 30,
      dividerHeight: 16,
      upperBandHeight: 31,
      emptyWorkbenchTopOffset: 11,
    });
    expect(resolveTitleBarLayout(0.8, true)).toEqual({
      height: 52,
      actionHeight: 24,
      dividerHeight: 13,
      upperBandHeight: 29,
      emptyWorkbenchTopOffset: 14,
    });
    expect(resolveTitleBarLayout(1.25, true)).toEqual({
      height: 70,
      actionHeight: 38,
      dividerHeight: 20,
      upperBandHeight: 35,
      emptyWorkbenchTopOffset: 10,
    });
    expect(resolveTitleBarLayout(1.1, true)).toEqual({
      height: 64,
      actionHeight: 33,
      dividerHeight: 18,
      upperBandHeight: 33,
      emptyWorkbenchTopOffset: 11,
    });
  });

  it('reserves enough height for enlarged collapsed sidebar actions', () => {
    expect(resolveTitleBarLayout(1, true, 1.8)).toEqual({
      height: 80,
      actionHeight: 30,
      dividerHeight: 16,
      upperBandHeight: 31,
      emptyWorkbenchTopOffset: 32,
    });
  });

  it.each([0.8, 0.9, 0.95, 1, 1.1, 1.25])(
    'keeps the empty workbench content origin stable at UI scale %s',
    (scale) => {
      const expanded = resolveTitleBarLayout(scale, false);
      const collapsed = resolveTitleBarLayout(scale, true);

      expect(collapsed.height - collapsed.emptyWorkbenchTopOffset).toBe(expanded.height);
    },
  );

  it.each([
    [0.8, 1],
    [1, 1.25],
    [1.25, 1.8],
  ])(
    'keeps the two docked titlebar rows separated at UI scale %s and sidebar scale %s',
    (scale, sidebarScale) => {
      const layout = resolveTitleBarLayout(scale, true, sidebarScale);
      const upperBandBottom = layout.upperBandHeight;
      const collapsedBandTop = layout.height - 1 - (26 * scale * sidebarScale);

      expect(collapsedBandTop - upperBandBottom).toBeGreaterThanOrEqual(1);
    },
  );

  it.each([
    [0.8, 1],
    [1, 1],
    [1.25, 1.8],
  ])(
    'resolves the docked band offset independent of the collapsed state at UI scale %s and sidebar scale %s',
    (scale, sidebarScale) => {
      expect(resolveDockedTitleBarBandOffset(scale, sidebarScale))
        .toBe(resolveTitleBarLayout(scale, true, sidebarScale).emptyWorkbenchTopOffset);
      expect(resolveDockedTitleBarBandOffset(scale, sidebarScale)).toBeGreaterThan(0);
    },
  );

});
