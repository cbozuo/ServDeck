import { useEffect } from 'react';

import { EventsOn, Show, WindowShow } from '../../wailsjs/runtime';
import { type SqlLog, useStore } from '../store';
import { useCustomThemeStore } from '../customThemeStore';
import type { TabData } from '../types';
import type { DetachedQueryResultWindow } from '../utils/detachedWindow';
import {
  clearNativeDetachedHostEvents,
  closeNativeDetachedWindowById,
  forwardNativeDetachedHostEvent,
  hasNativeDetachedWindowManager,
  syncNativeDetachedAppearance,
  syncNativeDetachedShortcutOptions,
  syncNativeDetachedThemeContext,
  getActiveNativeDetachedThemeContext,
} from '../utils/nativeDetachedWindowHost';
import {
  advanceNativeDetachedStoreSource,
  buildNativeDetachedWorkbenchMutableStoreSnapshot,
  mergeNativeDetachedStoreDelta,
  NATIVE_DETACHED_HOST_EVENT_NAMES,
  NATIVE_DETACHED_QUERY_RESULT_REDETACH_EVENT,
  type NativeDetachedHostEvent,
  type NativeDetachedHostEventName,
  type NativeDetachedStoreSnapshot,
  type NativeDetachedWindowKind,
} from '../utils/nativeDetachedWindowClient';
import { saveQueryEditorResultSessionForOpenQueryTab, type QueryEditorResultSessionSnapshot } from '../utils/queryEditorResultSessionCache';
import { setQueryTabDraft } from '../utils/sqlFileTabDrafts';

export const NATIVE_DETACHED_WINDOW_EVENT = 'gonavi:native-detached-event';

export type NativeDetachedWindowEvent = {
  id: string;
  kind: NativeDetachedWindowKind;
  action:
    | 'opened'
    | 'sync'
    | 'attach'
    | 'focus'
    | 'hide'
    | 'close'
    | 'cancel-close'
    | 'host-event';
  payload?: {
    revision?: number;
    tab?: TabData;
    storeState?: Record<string, unknown>;
    resultSession?: QueryEditorResultSessionSnapshot | null;
    resultWindow?: DetachedQueryResultWindow;
    ownerWindowId?: string;
    hostEvent?: NativeDetachedHostEvent;
    openedTabs?: TabData[];
    workbenchState?: NativeDetachedStoreSnapshot;
    workbenchStateBase?: NativeDetachedStoreSnapshot;
    clearSqlLogs?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
    [key: string]: unknown;
  };
};

const replaceSyncedTab = (tab: TabData): void => {
  if (tab.type === 'query' && typeof tab.query === 'string') {
    setQueryTabDraft(tab.id, tab.query);
  }
  useStore.setState((state) => {
    if (!state.tabs.some((item) => item.id === tab.id)) return state;
    return {
      tabs: state.tabs.map((item) => item.id === tab.id ? { ...item, ...tab, id: item.id } : item),
    };
  });
};

const mergeSyncedSqlLogs = (snapshot: Record<string, unknown>): void => {
  const incomingLogs = Array.isArray(snapshot.sqlLogs) ? snapshot.sqlLogs : [];
  if (incomingLogs.length > 0) {
    const existingIds = new Set(useStore.getState().sqlLogs.map((log) => log.id));
    const newLogs = incomingLogs.filter((item): item is SqlLog => {
      if (!item || typeof item !== 'object') return false;
      const id = String((item as { id?: unknown }).id || '').trim();
      if (!id || existingIds.has(id)) return false;
      existingIds.add(id);
      return true;
    });
    for (const log of [...newLogs].reverse()) {
      useStore.getState().addSqlLog(log);
    }
  }
};

const mergeSyncedTabRuntimeState = (
  tabId: string,
  snapshot: Record<string, unknown>,
): void => {
  const pendingPatch = snapshot.sqlEditorPendingTransactions;
  if (!pendingPatch || typeof pendingPatch !== 'object') return;
  const value = (pendingPatch as Record<string, unknown>)[tabId];
  useStore.setState((state) => {
    const next = { ...state.sqlEditorPendingTransactions };
    if (value === null || value === undefined) {
      delete next[tabId];
    } else {
      next[tabId] = value as (typeof next)[string];
    }
    return { sqlEditorPendingTransactions: next };
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

type WorkbenchStateSources = Map<string, NativeDetachedStoreSnapshot>;

const mergeSyncedWorkbenchState = (
  windowId: string,
  snapshot: NativeDetachedStoreSnapshot,
  sourceSnapshot?: NativeDetachedStoreSnapshot,
  workbenchStateSources?: WorkbenchStateSources,
): void => {
  const state = useStore.getState();
  const safeSnapshot = buildNativeDetachedWorkbenchMutableStoreSnapshot(snapshot);
  const sourceTabId = windowId.replace(/^workbench:/, '');
  if (
    Object.prototype.hasOwnProperty.call(safeSnapshot, 'activeContext')
    && (!windowId.startsWith('workbench:') || state.activeTabId !== sourceTabId)
  ) {
    delete safeSnapshot.activeContext;
  }
  if (Object.keys(safeSnapshot).length === 0) return;
  const previousSource = sourceSnapshot
    ?? workbenchStateSources?.get(windowId)
    ?? buildNativeDetachedWorkbenchMutableStoreSnapshot(state);
  useStore.setState(mergeNativeDetachedStoreDelta(
    state as unknown as NativeDetachedStoreSnapshot,
    previousSource,
    safeSnapshot,
  ) as unknown as typeof state, true);
  workbenchStateSources?.set(
    windowId,
    advanceNativeDetachedStoreSource(previousSource, safeSnapshot),
  );
};

const restoreQueryResult = (windowId: string): void => {
  const restored = useStore.getState().attachQueryResultWindow(windowId);
  if (!restored || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gonavi:restore-query-result', {
    detail: {
      windowId,
      sourceQueryTabId: restored.sourceQueryTabId,
      result: restored.result,
    },
  }));
};

const showMainWindow = (): void => {
  if (typeof window === 'undefined') return;
  const runtime = (window as any).runtime;
  if (typeof runtime?.Show === 'function') Show();
  if (typeof runtime?.WindowShow === 'function') WindowShow();
};

export const applyNativeDetachedWindowEvent = (
  event: NativeDetachedWindowEvent,
  currentWindowId?: string,
  callbacks: {
    onHostEvent?: (event: NativeDetachedHostEvent) => void;
    workbenchStateSources?: WorkbenchStateSources;
  } = {},
): void => {
  const id = String(event?.id || '').trim();
  if (
    !id
    || (event.kind !== 'workbench' && event.kind !== 'query-result')
  ) return;

  const localWindowId = String(currentWindowId || '').trim();
  const ownerWindowId = String(event.payload?.ownerWindowId || '').trim();
  if (localWindowId) {
    // The parent broadcasts lifecycle events to every child. Applying a child's
    // own sync back into its store would schedule another sync indefinitely.
    if (id === localWindowId) return;
    if (event.kind === 'query-result') {
      // Result lifecycle belongs to its source SQL window. The result window
      // process itself receives the same broadcast but must not mutate a copy.
      if (ownerWindowId !== localWindowId) return;
    } else if (id !== localWindowId && ownerWindowId !== localWindowId) {
      return;
    }
  }

  if (event.action === 'opened') {
    const resultWindow = event.payload?.resultWindow;
    if (
      event.kind === 'query-result'
      && resultWindow
      && typeof resultWindow === 'object'
      && String(resultWindow.id || '').trim() === id
    ) {
      useStore.getState().detachQueryResultWindow(resultWindow);
      callbacks.workbenchStateSources?.set(
        id,
        buildNativeDetachedWorkbenchMutableStoreSnapshot(useStore.getState()),
      );
    }
    return;
  }

  if (event.action === 'focus') {
    return;
  }

  if (event.action === 'host-event') {
    const hostEvent = event.payload?.hostEvent;
    if (
      hostEvent
      && typeof hostEvent === 'object'
      && String(hostEvent.id || '').trim()
      && NATIVE_DETACHED_HOST_EVENT_NAMES.includes(hostEvent.name as NativeDetachedHostEventName)
    ) {
      if (
        !localWindowId
        && (
          hostEvent.name === 'gonavi:open-global-proxy-settings'
          || hostEvent.name === 'gonavi:open-download-source-settings'
        )
      ) {
        showMainWindow();
      }
      callbacks.onHostEvent?.(hostEvent);
    }
    return;
  }

  const bounds = event.payload?.bounds;
  if (
    bounds
    && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    && bounds.width > 0
    && bounds.height > 0
  ) {
    if (event.kind === 'workbench') {
      useStore.getState().updateDetachedWorkbenchBounds(
        event.payload?.tab?.id || id.replace(/^workbench:/, ''),
        bounds,
      );
    } else {
      useStore.getState().updateDetachedQueryResultBounds(id, bounds);
    }
  }

  const tab = event.payload?.tab;
  const eventTabId = tab?.id || id.replace(/^workbench:/, '');
  if (
    event.kind === 'query-result'
    && event.payload?.resultWindow
    && event.payload.resultWindow.id === id
  ) {
    useStore.getState().detachQueryResultWindow(event.payload.resultWindow);
  }
  if (event.payload?.clearSqlLogs === true) {
    useStore.getState().clearSqlLogs();
  }
  if (event.payload?.storeState) {
    mergeSyncedSqlLogs(event.payload.storeState);
    if (event.kind === 'workbench') {
      mergeSyncedTabRuntimeState(eventTabId, event.payload.storeState);
    }
  }
  if (event.kind === 'workbench' && tab) {
    replaceSyncedTab(tab);
    if (event.action !== 'cancel-close') {
      saveQueryEditorResultSessionForOpenQueryTab(tab, event.payload?.resultSession, useStore.getState().tabs);
    }
  }
  if (
    (event.kind === 'workbench' || event.kind === 'query-result')
    && event.payload?.workbenchState
  ) {
    mergeSyncedWorkbenchState(
      id,
      event.payload.workbenchState,
      event.payload.workbenchStateBase,
      callbacks.workbenchStateSources,
    );
  }
  if (event.kind === 'workbench' && Array.isArray(event.payload?.openedTabs)) {
    for (const openedTab of event.payload.openedTabs) {
      if (!openedTab || typeof openedTab !== 'object' || !String(openedTab.id || '').trim()) continue;
      if (openedTab.type === 'query' && typeof openedTab.query === 'string') {
        setQueryTabDraft(openedTab.id, openedTab.query);
      }
      if (!useStore.getState().tabs.some((item) => item.id === openedTab.id)) {
        useStore.getState().addTab(openedTab);
      }
    }
    if (event.payload.openedTabs.length > 0) showMainWindow();
  }

  if (event.action === 'cancel-close') {
    if (event.kind === 'workbench') {
      const tabId = tab?.id || id.replace(/^workbench:/, '');
      if (tab && tab.id === tabId && !useStore.getState().tabs.some((item) => item.id === tabId)) {
        useStore.setState((state) => ({ tabs: [...state.tabs, tab] }));
      }
      const latest = useStore.getState();
      if (latest.tabs.some((item) => item.id === tabId) && !latest.isWorkbenchTabDetached(tabId)) {
        latest.detachWorkbenchTab(tabId);
      }
      saveQueryEditorResultSessionForOpenQueryTab(tab, event.payload?.resultSession, useStore.getState().tabs);
    } else if (
      event.payload?.rollbackAction === 'attach'
      && event.payload.resultWindow
      && typeof window !== 'undefined'
    ) {
      const resultWindow = event.payload.resultWindow;
      const windowId = String(resultWindow.id || '').trim();
      const sourceQueryTabId = String(resultWindow.sourceQueryTabId || '').trim();
      const resultKey = String(resultWindow.result?.key || '').trim();
      if (windowId === id && sourceQueryTabId && resultKey) {
        window.dispatchEvent(new CustomEvent(NATIVE_DETACHED_QUERY_RESULT_REDETACH_EVENT, {
          detail: { windowId, sourceQueryTabId, resultKey },
        }));
      }
    }
    return;
  }

  if (event.action === 'sync') return;
  if (event.action === 'hide') {
    return;
  }
  if (event.action === 'close') {
    clearNativeDetachedHostEvents(id);
    callbacks.workbenchStateSources?.delete(id);
  }
  if (event.action === 'attach') {
    callbacks.workbenchStateSources?.delete(id);
    if (event.kind === 'workbench') {
      const tabId = tab?.id || id.replace(/^workbench:/, '');
      useStore.getState().attachWorkbenchTab(tabId);
    } else {
      restoreQueryResult(id);
    }
    showMainWindow();
    clearNativeDetachedHostEvents(id);
    return;
  }

  if (event.kind === 'workbench') {
    const tabId = tab?.id || id.replace(/^workbench:/, '');
    const reason = String(event.payload?.reason || '').trim();
    const stillDetached = useStore.getState().detachedWorkbenchWindows.some(
      (item) => item.tabId === tabId,
    );
    if (reason === 'attached' || reason === 'parent-shutdown' || reason === 'requested') {
      return;
    }
    if (event.payload?.exited === true) {
      if (stillDetached) {
        useStore.getState().attachWorkbenchTab(tabId);
        showMainWindow();
      }
      return;
    }
    if (!stillDetached) return;
    if (useStore.getState().tabs.some((item) => item.id === tabId)) {
      useStore.getState().closeTab(tabId);
    }
  } else {
    const reason = String(event.payload?.reason || '').trim();
    const stillDetached = useStore.getState().detachedQueryResultWindows.some(
      (item) => item.id === id,
    );
    if (reason === 'attached' || reason === 'parent-shutdown' || reason === 'requested') {
      return;
    }
    if (event.payload?.exited === true) {
      if (stillDetached) {
        restoreQueryResult(id);
        showMainWindow();
      }
      return;
    }
    useStore.getState().closeDetachedQueryResultWindow(id);
  }
  clearNativeDetachedHostEvents(id);
};

const currentNativeWindowIds = (): Set<string> => {
  const state = useStore.getState();
  return new Set([
    ...state.detachedWorkbenchWindows.map((item) => `workbench:${item.tabId}`),
    ...state.detachedQueryResultWindows.map((item) => item.id),
  ]);
};

const areNativeDetachedThemeContextsEqual = (
  left: ReturnType<typeof getActiveNativeDetachedThemeContext>,
  right: ReturnType<typeof getActiveNativeDetachedThemeContext>,
): boolean => (
  left === right
  || (
    left !== null
    && right !== null
    && left.id === right.id
    && left.updatedAt === right.updatedAt
    && left.css === right.css
  )
);

export interface NativeDetachedWindowControllerProps {
  currentWindowId?: string;
}

const NativeDetachedWindowController = ({
  currentWindowId,
}: NativeDetachedWindowControllerProps = {}): null => {
  useEffect(() => {
    if (!hasNativeDetachedWindowManager()) return undefined;

    const workbenchStateSources: WorkbenchStateSources = new Map();
    const initialWorkbenchSource = buildNativeDetachedWorkbenchMutableStoreSnapshot(
      useStore.getState(),
    );
    for (const id of currentNativeWindowIds()) {
      workbenchStateSources.set(id, initialWorkbenchSource);
    }
    const dispatchHostEventLocally = (hostEvent: NativeDetachedHostEvent) => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(new CustomEvent(hostEvent.name, {
        detail: hostEvent.detail,
      }));
    };
    const off = EventsOn(NATIVE_DETACHED_WINDOW_EVENT, (payload: NativeDetachedWindowEvent) => {
      applyNativeDetachedWindowEvent(payload, currentWindowId, {
        onHostEvent: dispatchHostEventLocally,
        workbenchStateSources,
      });
    });
    let previousIds = currentNativeWindowIds();
    let previousAppearance = useStore.getState().appearance;
    let previousShortcutOptions = useStore.getState().shortcutOptions;
    let previousCustomTheme = getActiveNativeDetachedThemeContext();
    let appearanceSyncTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingAppearanceSyncTargets = new Set<string>();
    let pendingAppearance = previousAppearance;
    const scheduleAppearanceSync = (
      targetWindowIds: Iterable<string>,
      appearance: typeof previousAppearance,
    ) => {
      if (currentWindowId) return;
      for (const id of targetWindowIds) pendingAppearanceSyncTargets.add(id);
      if (pendingAppearanceSyncTargets.size === 0) return;
      pendingAppearance = appearance;
      if (appearanceSyncTimer !== null) clearTimeout(appearanceSyncTimer);
      appearanceSyncTimer = setTimeout(() => {
        appearanceSyncTimer = null;
        const currentIds = currentNativeWindowIds();
        const targetIds = Array.from(pendingAppearanceSyncTargets).filter((id) => currentIds.has(id));
        pendingAppearanceSyncTargets = new Set<string>();
        if (targetIds.length === 0) return;
        void syncNativeDetachedAppearance(targetIds, pendingAppearance).catch((error) => {
          console.warn('[Native Detached Window] Failed to sync appearance settings', error);
        });
      }, 40);
    };
    const unsubscribeStore = useStore.subscribe(() => {
      const nextState = useStore.getState();
      const nextIds = currentNativeWindowIds();
      const nextShortcutOptions = nextState.shortcutOptions;
      const nextAppearance = nextState.appearance;
      const newlyOpenedIds = new Set<string>();
      for (const id of nextIds) {
        if (!previousIds.has(id)) {
          newlyOpenedIds.add(id);
        }
        if (!previousIds.has(id)) {
          workbenchStateSources.set(
            id,
            buildNativeDetachedWorkbenchMutableStoreSnapshot(useStore.getState()),
          );
        }
      }
      for (const id of previousIds) {
        if (!nextIds.has(id)) {
          void closeNativeDetachedWindowById(id).catch(() => undefined);
          clearNativeDetachedHostEvents(id);
          workbenchStateSources.delete(id);
        }
      }
      previousIds = nextIds;
      const appearanceChanged = nextAppearance !== previousAppearance;
      if (appearanceChanged) {
        previousAppearance = nextAppearance;
      }
      const appearanceSyncTargets = appearanceChanged ? nextIds : newlyOpenedIds;
      scheduleAppearanceSync(appearanceSyncTargets, nextAppearance);
      const shortcutOptionsChanged = nextShortcutOptions !== previousShortcutOptions;
      if (shortcutOptionsChanged) {
        previousShortcutOptions = nextShortcutOptions;
      }
      const shortcutSyncTargets = shortcutOptionsChanged ? nextIds : newlyOpenedIds;
      if (!currentWindowId && shortcutSyncTargets.size > 0) {
        void syncNativeDetachedShortcutOptions(shortcutSyncTargets, nextShortcutOptions).catch((error) => {
          console.warn('[Native Detached Window] Failed to sync shortcut options', error);
        });
      }
    });
    const unsubscribeCustomTheme = useCustomThemeStore.subscribe(() => {
      const nextCustomTheme = getActiveNativeDetachedThemeContext();
      if (areNativeDetachedThemeContextsEqual(previousCustomTheme, nextCustomTheme)) return;
      previousCustomTheme = nextCustomTheme;
      if (currentWindowId) return;
      const targetWindowIds = currentNativeWindowIds();
      if (targetWindowIds.size === 0) return;
      void syncNativeDetachedThemeContext(targetWindowIds, nextCustomTheme).catch((error) => {
        console.warn('[Native Detached Window] Failed to sync custom theme', error);
      });
    });

    const removeWindowEventListeners: Array<() => void> = [];
    if (!currentWindowId && typeof window !== 'undefined') {
      const forwardTargetedWorkbenchEvent = (event: Event) => {
        const detail = (event as CustomEvent<Record<string, unknown>>).detail;
        const tabId = String(detail?.tabId || detail?.targetTabId || '').trim();
        if (!tabId || !useStore.getState().isWorkbenchTabDetached(tabId)) return;
        void forwardNativeDetachedHostEvent(
          `workbench:${tabId}`,
          event.type as NativeDetachedHostEventName,
          detail,
        ).catch((error) => {
          console.warn('[Native Detached Window] Failed to forward event to workbench window', error);
        });
      };
      for (const eventName of [
        'gonavi:insert-sql-to-tab',
        'gonavi:jvm-apply-diagnostic-plan',
        'gonavi:locate-sidebar-object',
      ] as const) {
        window.addEventListener(eventName, forwardTargetedWorkbenchEvent);
        removeWindowEventListeners.push(
          () => window.removeEventListener(eventName, forwardTargetedWorkbenchEvent),
        );
      }
    }

    return () => {
      off();
      unsubscribeStore();
      unsubscribeCustomTheme();
      removeWindowEventListeners.forEach((remove) => remove());
      if (appearanceSyncTimer !== null) clearTimeout(appearanceSyncTimer);
      workbenchStateSources.clear();
    };
  }, [currentWindowId]);

  return null;
};

export default NativeDetachedWindowController;
