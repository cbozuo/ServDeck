import { describe, expect, it } from 'vitest';

import {
  closeConfirmedWorkbenchTabs,
  isMainWindowBoundWorkbenchTab,
  isRunningDataImportWorkbenchTab,
} from './TabManager';

describe('TabManager background task window guard', () => {

  it('blocks closing a data import tab only while its foreground task is running', () => {
    expect(isRunningDataImportWorkbenchTab({
      type: 'data-import',
      dataImportRunning: true,
    })).toBe(true);
    expect(isRunningDataImportWorkbenchTab({
      type: 'data-import',
      dataImportRunning: false,
    })).toBe(false);
  });
});

describe('TabManager main-window-bound tab detach', () => {

  it('routes settings center, service detail and background task workbenches to the overlay window', () => {
    expect(isMainWindowBoundWorkbenchTab({ type: 'settings-center' })).toBe(true);
    expect(isMainWindowBoundWorkbenchTab({ type: 'service-detail' })).toBe(true);
    expect(isMainWindowBoundWorkbenchTab({ type: 'table-export' })).toBe(true);
    expect(isMainWindowBoundWorkbenchTab({ type: 'data-import' })).toBe(true);
    expect(isMainWindowBoundWorkbenchTab({ type: 'data-sync' })).toBe(true);
  });

  it('keeps other workbench tabs on the native detached window path', () => {
    expect(isMainWindowBoundWorkbenchTab({ type: 'query' })).toBe(false);
    expect(isMainWindowBoundWorkbenchTab({ type: 'driver-manager' })).toBe(false);
    expect(isMainWindowBoundWorkbenchTab({ type: 'jvm-overview' })).toBe(false);
  });
});

describe('TabManager confirmed close targets', () => {
  it('只关闭确认时固定的标签集合，不重新计算批量关闭范围', () => {
    const closed: string[] = [];

    closeConfirmedWorkbenchTabs(['tab-1', 'tab-2', 'tab-1', ''], (id) => {
      closed.push(id);
    });

    expect(closed).toEqual(['tab-1', 'tab-2']);
  });
});
