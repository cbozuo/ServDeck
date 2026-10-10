import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStore } from '../store';
import type { TabData } from '../types';
import {
  clearNativeDetachedHostEvents,
  openNativeQueryResultWindow,
  openNativeWorkbenchTabWindow,
  forwardNativeDetachedHostEvent,
  syncNativeDetachedAppearance,
  syncNativeDetachedShortcutOptions,
  syncNativeDetachedThemeContext,
  type NativeDetachedWindowManager,
} from './nativeDetachedWindowHost';
import { clearQueryTabDraft, setQueryTabDraft } from './sqlFileTabDrafts';
import { NATIVE_DETACHED_CUSTOM_THEME_CONTEXT_KEY } from './nativeDetachedWindowClient';

const buildTab = (id: string) => ({
  id,
  title: `Query ${id}`,
  type: 'query' as const,
  connectionId: 'conn-1',
  dbName: 'main',
  query: 'select 1',
});

describe('nativeDetachedWindowHost', () => {
  let manager: NativeDetachedWindowManager;

  beforeEach(() => {
    clearNativeDetachedHostEvents('query-1');
    manager = {
      Open: vi.fn().mockResolvedValue({ success: true }),
      Focus: vi.fn().mockResolvedValue({ success: true }),
      Hide: vi.fn().mockResolvedValue({ success: true, visibilityRevision: 1 }),
      Close: vi.fn().mockResolvedValue({ success: true }),
      CloseAll: vi.fn().mockResolvedValue({ success: true }),
      SyncHostState: vi.fn().mockResolvedValue({ success: true }),
    };
    useStore.setState({
      tabs: [buildTab('query-1')],
      activeTabId: 'query-1',
      detachedWorkbenchWindows: [],
      detachedQueryResultWindows: [],
    });
  });

  afterEach(() => {
    clearQueryTabDraft('query-1');
    vi.restoreAllMocks();
  });

  it('hides the docked tab only after the native window opens', async () => {
    let resolveOpen: ((value: { success: boolean }) => void) | undefined;
    const pending = new Promise<{ success: boolean }>((resolve) => {
      resolveOpen = resolve;
    });
    vi.mocked(manager.Open).mockReturnValueOnce(pending);

    const opening = openNativeWorkbenchTabWindow('query-1', { x: -1600, y: 120 }, manager);
    expect(useStore.getState().isWorkbenchTabDetached('query-1')).toBe(false);

    resolveOpen?.({ success: true });
    await expect(opening).resolves.toBe(true);
    expect(useStore.getState().isWorkbenchTabDetached('query-1')).toBe(true);
    expect(manager.Open).toHaveBeenCalledWith(expect.objectContaining({
      id: 'workbench:query-1',
      kind: 'workbench',
      x: -1600,
      y: 120,
    }));
  });

  it('keeps the tab docked when native window creation fails', async () => {
    vi.mocked(manager.Open).mockResolvedValueOnce({ success: false, message: 'open failed' });

    await expect(
      openNativeWorkbenchTabWindow('query-1', { x: 2000, y: -300 }, manager),
    ).rejects.toThrow('open failed');
    expect(useStore.getState().isWorkbenchTabDetached('query-1')).toBe(false);
  });

  it('focuses an existing window instead of opening a duplicate', async () => {
    await openNativeWorkbenchTabWindow('query-1', undefined, manager);
    await openNativeWorkbenchTabWindow('query-1', undefined, manager);

    expect(manager.Open).toHaveBeenCalledTimes(1);
    expect(manager.Focus).toHaveBeenCalledTimes(2);
    expect(manager.Focus).toHaveBeenCalledWith('workbench:query-1');
  });

  it('restores the source tab when a just-ready child exits before detach commits', async () => {
    vi.mocked(manager.Focus).mockResolvedValueOnce({
      success: false,
      message: 'native window was not found',
    });

    await expect(openNativeWorkbenchTabWindow('query-1', undefined, manager))
      .rejects.toThrow('native window was not found');

    expect(useStore.getState().isWorkbenchTabDetached('query-1')).toBe(false);
    expect(useStore.getState().tabs.map((tab) => tab.id)).toContain('query-1');
  });

  it('opens many tabs with unique native window ids without a hard cap', async () => {
    const tabs = Array.from({ length: 32 }, (_, index) => buildTab(`query-${index + 1}`));
    useStore.setState({ tabs, detachedWorkbenchWindows: [] });

    await Promise.all(tabs.map((tab) => openNativeWorkbenchTabWindow(tab.id, undefined, manager)));

    const ids = vi.mocked(manager.Open).mock.calls.map(([request]) => request.id);
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
    expect(useStore.getState().detachedWorkbenchWindows).toHaveLength(32);
  });

  it('routes every detachable workbench tab type through the native window manager', async () => {
    const types: TabData['type'][] = [
      'query',
      'table',
      'design',
      'sql-file-execution',
      'sql-analysis',
      'sql-audit',
      'settings-center',
      'redis-keys',
      'redis-command',
      'redis-monitor',
      'trigger',
      'view-def',
      'event-def',
      'routine-def',
      'sequence-def',
      'package-def',
      'database-link-def',
      'table-overview',
      'table-export',
      'jvm-overview',
      'jvm-resource',
      'jvm-audit',
      'jvm-diagnostic',
      'jvm-monitoring',
    ];
    const tabs = types.map((type, index): TabData => ({
      id: `matrix-${index}`,
      title: type,
      type,
      connectionId: 'conn-1',
    }));
    useStore.setState({ tabs, detachedWorkbenchWindows: [] });

    await Promise.all(tabs.map((tab) => openNativeWorkbenchTabWindow(tab.id, undefined, manager)));

    expect(manager.Open).toHaveBeenCalledTimes(types.length);
    expect(vi.mocked(manager.Open).mock.calls.map(([request]) => ({
      kind: request.kind,
      type: request.payload.tab?.type,
    }))).toEqual(types.map((type) => ({ kind: 'workbench', type })));
  });

  it('pushes changed shortcut options to every detached window kind', async () => {
    const shortcutOptions = {
      toggleAIPanel: {
        mac: { combo: 'Meta+K', enabled: false },
        windows: { combo: 'Ctrl+K', enabled: false },
      },
    };

    await expect(syncNativeDetachedShortcutOptions([
      'workbench:query-1',
      'query-result:query-1:r1',
    ], shortcutOptions, manager)).resolves.toBe(true);

    expect(manager.SyncHostState).toHaveBeenCalledTimes(2);
    expect(vi.mocked(manager.SyncHostState!).mock.calls.map(([request]) => request.id))
      .toEqual([
        'workbench:query-1',
        'query-result:query-1:r1',
      ]);
    for (const [request] of vi.mocked(manager.SyncHostState!).mock.calls) {
      expect(request).toEqual(expect.objectContaining({ revision: expect.any(Number) }));
      expect(request.storeState).toEqual({ shortcutOptions });
    }
  });

  it('pushes changed appearance settings to every detached window kind', async () => {
    const appearance = {
      ...useStore.getState().appearance,
      toolbarButtonColorOverrides: {
        query: {
          'button-bg': 'rgba(18, 52, 86, 0.8)',
        },
      },
    };

    await expect(syncNativeDetachedAppearance([
      'workbench:query-1',
      'query-result:query-1:r1',
    ], appearance, manager)).resolves.toBe(true);

    expect(manager.SyncHostState).toHaveBeenCalledTimes(2);
    for (const [request] of vi.mocked(manager.SyncHostState!).mock.calls) {
      expect(request.storeState).toEqual({ appearance });
    }
  });

  it('pushes the active custom theme context to every detached window kind', async () => {
    const theme = {
      schemaVersion: 1 as const,
      id: 'theme-host-sync',
      name: 'Host sync',
      sourceFileName: 'host-sync.css',
      baseMode: 'light' as const,
      css: 'body[data-custom-theme] { --gn-bg-panel: #e8f5ee; --gn-monaco-bg: #e8f5ee; }',
      createdAt: 1,
      updatedAt: 2,
    };

    await expect(syncNativeDetachedThemeContext([
      'workbench:query-1',
      'query-result:query-1:r1',
    ], theme, manager)).resolves.toBe(true);

    expect(manager.SyncHostState).toHaveBeenCalledTimes(2);
    for (const [request] of vi.mocked(manager.SyncHostState!).mock.calls) {
      expect(request.storeState[NATIVE_DETACHED_CUSTOM_THEME_CONTEXT_KEY]).toEqual(theme);
    }
  });

  it('opens a query result snapshot as a native window on another display', async () => {
    await expect(openNativeQueryResultWindow({
      id: 'query-result:query-1:r1',
      sourceQueryTabId: 'query-1',
      connectionId: 'conn-1',
      dbName: 'main',
      title: 'Result 1',
      x: 2100,
      y: -240,
      result: {
        key: 'r1',
        sql: 'select 42',
        rows: [{ value: 42 }],
        columns: ['value'],
        pkColumns: [],
        readOnly: true,
      },
    }, manager)).resolves.toBe(true);

    expect(manager.Open).toHaveBeenCalledWith(expect.objectContaining({
      id: 'query-result:query-1:r1',
      kind: 'query-result',
      x: 2100,
      y: -240,
    }));
    expect(useStore.getState().detachedQueryResultWindows).toHaveLength(1);
  });

  it('closes a just-opened result child when its source tab closed while native open was pending', async () => {
    let resolveOpen: ((value: { success: boolean }) => void) | undefined;
    vi.mocked(manager.Open).mockReturnValueOnce(new Promise((resolve) => {
      resolveOpen = resolve;
    }));

    const opening = openNativeQueryResultWindow({
      id: 'query-result:query-1:r-pending',
      sourceQueryTabId: 'query-1',
      connectionId: 'conn-1',
      dbName: 'main',
      title: 'Pending result',
      result: {
        key: 'r-pending',
        sql: 'select 42',
        rows: [{ value: 42 }],
        columns: ['value'],
        pkColumns: [],
        readOnly: true,
      },
    }, manager);

    useStore.getState().closeTab('query-1');
    resolveOpen?.({ success: true });

    await expect(opening).resolves.toBe(false);
    expect(manager.Close).toHaveBeenCalledOnce();
    expect(manager.Close).toHaveBeenCalledWith('query-result:query-1:r-pending');
    expect(manager.Focus).not.toHaveBeenCalled();
    expect(useStore.getState().detachedQueryResultWindows).toEqual([]);
  });
});
