import { describe, expect, it } from 'vitest';
import {
  applyTabDisplaySettingsPatch,
  buildTabDisplayModel,
  buildTabDisplayTitle,
  DEFAULT_TAB_DISPLAY_SETTINGS,
  getSavedTabDisplaySnapshot,
  resolveTabDisplayElementOrder,
  sanitizeTabDisplaySettings,
  switchTabDisplayLayout,
} from './tabDisplay';
import type { TabData } from '../types';

const makeTab = (overrides: Partial<TabData> = {}): TabData => ({
  id: 'tab-1',
  title: 'Tab 1',
  type: 'service-detail',
  connectionId: '',
  serviceName: 'order-service',
  ...overrides,
});

describe('tabDisplay settings', () => {
  it('falls back to defaults for invalid settings payloads', () => {
    const settings = sanitizeTabDisplaySettings('nope');
    expect(settings.layout).toBe(DEFAULT_TAB_DISPLAY_SETTINGS.layout);
    expect(settings.primaryElements).toEqual(DEFAULT_TAB_DISPLAY_SETTINGS.primaryElements);
    expect(resolveTabDisplayElementOrder(null)).toEqual(['object', 'kind']);
  });

  it('drops unknown element keys while sanitizing', () => {
    const settings = sanitizeTabDisplaySettings({
      layout: 'double',
      primaryElements: ['object', 'connection' as never],
      secondaryElements: ['kind'],
    });
    expect(settings.primaryElements).toEqual(['object']);
    expect(settings.secondaryElements).toEqual(['kind']);
  });

  it('switches layouts and remembers per-layout snapshots', () => {
    const original = sanitizeTabDisplaySettings(DEFAULT_TAB_DISPLAY_SETTINGS);
    const switched = switchTabDisplayLayout(original, 'single');
    expect(switched.layout).toBe('single');
    const back = switchTabDisplayLayout(switched, 'double');
    expect(getSavedTabDisplaySnapshot(back, 'single').primaryElements).toEqual(
      switched.primaryElements,
    );
    expect(back.layout).toBe('double');
  });

  it('applies patches and re-sanitizes the result', () => {
    const original = sanitizeTabDisplaySettings(DEFAULT_TAB_DISPLAY_SETTINGS);
    const patched = applyTabDisplaySettingsPatch(original, {
      primaryElements: ['kind'],
    });
    expect(patched.primaryElements).toEqual(['kind']);
  });
});

describe('tab display titles for retained workbench tabs', () => {
  it('uses the registered display name for service detail tabs', () => {
    const model = buildTabDisplayModel(makeTab());
    expect(model.layout).toBe('single');
    expect(model.secondaryParts).toEqual([]);
    expect(model.fullTitle).toBe('order-service');
  });

  it('labels JVM tabs with the JVM kind badge', () => {
    const model = buildTabDisplayModel(makeTab({
      id: 'tab-2',
      type: 'jvm-diagnostic',
      title: 'order-service · diagnostic',
      serviceName: undefined,
    }));
    expect(model.fullTitle).toContain('order-service · diagnostic');
    expect(model.secondaryParts.some((part) => part.key === 'kind' && part.value === 'JVM')).toBe(true);
  });

  it('builds settings center titles from the catalog', () => {
    expect(buildTabDisplayTitle(makeTab({ type: 'settings-center', serviceName: undefined }))).toBeTruthy();
  });
});
