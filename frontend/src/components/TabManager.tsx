import Modal from './common/ResizableDraggableModal';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, message, Tabs, Tooltip } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CloseCircleOutlined, CloseOutlined, ExportOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps, TabsProps } from 'antd';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TabData } from '../types';
import { t } from '../i18n';
import { useStore } from '../store';
import type { TabDisplayModel, TabDisplayPart } from '../utils/tabDisplay';
import { buildTabDisplayModel } from '../utils/tabDisplay';
import { CLOSE_ACTIVE_WORKSPACE_TAB_EVENT, resolveDockedActiveTabId } from '../utils/closeTabShortcut';
import { REQUEST_CLOSE_WORKBENCH_TABS_EVENT } from '../utils/workbenchTabCloseProtection';
import WorkbenchTabContent from './WorkbenchTabContent';
import DetachDragPreview, {
  buildDetachDragPreviewState,
  type DetachDragPreviewState,
} from './DetachDragPreview';
import {
  type NativeDetachTerminalPointer,
  resolveNativeDetachDragRelease,
  resolveNativeDetachPreferredBounds,
  shouldDetachAfterNativePointerCancel,
  shouldDetachAtScreenPoint,
  shouldDetachTabByDrag,
} from '../utils/detachedWindow';
import { openNativeWorkbenchTabWindow } from '../utils/nativeDetachedWindowHost';
import { isMainWindowBoundWorkbenchTab } from '../utils/workbenchTabKinds';
import { ServiceHome } from './home/ServiceHome';
import { useServiceDetailStore } from '../serviceDetailStore';
import { useServiceRegistryStore } from '../serviceRegistryStore';
import { ServiceHoverTooltip } from './ServiceHoverTooltip';
import { useWorkbenchTabs } from '../hooks/useWorkbenchTabs';
import { createSidebarResizeAwareFrameScheduler } from '../utils/sidebarResizeLifecycle';
import { renderV2ActionMenuPopup } from './common/V2ActionMenuPopup';

const getTabKindLabel = (tab: TabData): string => {
  // 设置中心：标题「设置中心」已表意，不叠加类型角标（用户反馈：去掉 SETTINGS 英文）
  if (tab.type === 'settings-center') return '';
  // 服务详情：服务名已是完整标题，去掉 SVC 缩写角标（用户反馈）
  if (tab.type === 'service-detail') return '';
  if (tab.type.startsWith('jvm')) return t('tab_manager.kind_badge.jvm');
  return t('tab_manager.kind_badge.fallback');
};

export const TAB_WORKBENCH_CLASS_NAME = 'tab-workbench';
export const TAB_ENVIRONMENT_ACCENT_CSS_HEIGHT = 'var(--gn-tab-environment-accent-thickness, 2px)';

const sanitizeTabEnvironmentAccentThickness = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
};

export const buildTabWorkbenchStyle = (
  v2TabWidth: number,
  tabEnvironmentAccentThickness: unknown,
): React.CSSProperties => ({
  ...({ '--gn-v2-tab-width': `${v2TabWidth}px` }),
  '--gn-tab-environment-accent-thickness': `${sanitizeTabEnvironmentAccentThickness(tabEnvironmentAccentThickness)}px`,
} as React.CSSProperties);

export const V2_WORKBENCH_TAB_MIN_WIDTH = 112;
export const V2_WORKBENCH_TAB_MAX_WIDTH = 260;
const V2_WORKBENCH_TAB_WIDTH_GUARD = 1;

export const resolveV2WorkbenchTabWidth = (availableWidth: number, tabCount: number): number => {
  const normalizedTabCount = Number.isFinite(tabCount) ? Math.floor(tabCount) : 0;
  if (!Number.isFinite(availableWidth) || availableWidth <= 0 || normalizedTabCount <= 0) {
    return V2_WORKBENCH_TAB_MAX_WIDTH;
  }

  const equalShare = Math.floor(
    (availableWidth - V2_WORKBENCH_TAB_WIDTH_GUARD) / normalizedTabCount,
  );
  return Math.min(
    V2_WORKBENCH_TAB_MAX_WIDTH,
    Math.max(V2_WORKBENCH_TAB_MIN_WIDTH, equalShare),
  );
};

const getCloseOtherTabIds = (tabs: TabData[], id: string): string[] =>
  tabs.filter((tab) => tab.id !== id).map((tab) => tab.id);

const getCloseTabsToLeftIds = (tabs: TabData[], id: string): string[] => {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index <= 0) return [];
  return tabs.slice(0, index).map((tab) => tab.id);
};

const getCloseTabsToRightIds = (tabs: TabData[], id: string): string[] => {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0 || index >= tabs.length - 1) return [];
  return tabs.slice(index + 1).map((tab) => tab.id);
};

/** Close only the target set confirmed by the user, even if tabs change later. */
export const closeConfirmedWorkbenchTabs = (
  targetIds: readonly string[],
  closeTab: (id: string) => void,
): void => {
  Array.from(new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean)))
    .forEach((id) => closeTab(id));
};

export const openTabDisplaySettings = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent('gonavi:open-tab-display-settings'));
};

type SortableTabLabelProps = {
  tab: TabData;
  displayModel: TabDisplayModel;
  displayTitle: string;
  menuItems: MenuProps['items'];
  onClose?: () => void;
};

export const isMiddleMouseButton = (button: number): boolean => button === 1;

const renderV2TabDisplayPart = (part: TabDisplayPart) => {
  if (part.key === 'kind') {
    return (
      <span className="gn-v2-tab-kind" key={part.key}>
        {part.text}
      </span>
    );
  }
  return (
    <span className={`gn-v2-tab-label-part gn-v2-tab-label-part-${part.key}`} key={part.key}>
      {part.text}
    </span>
  );
};

const renderV2TabSecondaryParts = (parts: TabDisplayPart[]) => parts.map((part, index) => (
  <React.Fragment key={part.key}>
    {index > 0 ? <span className="gn-v2-tab-label-separator" aria-hidden="true">·</span> : null}
    {renderV2TabDisplayPart(part)}
  </React.Fragment>
));

const SortableTabLabel: React.FC<SortableTabLabelProps> = ({
  tab,
  displayModel,
  displayTitle,
  menuItems,
  onClose,
}) => {
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);

  const handleTabLabelContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setIsTabMenuOpen(true);
  };

  const handleTabLabelMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (!onClose || !isMiddleMouseButton(event.button)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleTabLabelAuxClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!onClose || !isMiddleMouseButton(event.button)) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  const handleTabMenuOpenChange = (open: boolean) => {
    setIsTabMenuOpen(open);
  };

  const tabDisplayPartCount = displayModel.primaryParts.length + displayModel.secondaryParts.length;
  const showSecondaryLine = displayModel.layout === 'double' && Boolean(displayModel.secondaryText);
  const labelNode = (
    <span
      className={`tab-dnd-label gn-v2-tab-label${showSecondaryLine ? ' gn-v2-tab-label-double' : ''}${tabDisplayPartCount >= 4 ? ' gn-v2-tab-label-rich' : ''}`}
      onContextMenu={handleTabLabelContextMenu}
      onMouseDown={handleTabLabelMouseDown}
      onAuxClick={handleTabLabelAuxClick}
      title={undefined}
    >
      <span className="gn-v2-tab-label-content">
          <span className="gn-v2-tab-label-main tab-title-text">
            {displayModel.primaryParts.length > 0
              ? displayModel.primaryParts.map(renderV2TabDisplayPart)
              : displayModel.primaryText}
          </span>
          {showSecondaryLine ? (
            <span
              className="gn-v2-tab-label-secondary"
              aria-label={displayModel.secondaryText}
            >
              {renderV2TabSecondaryParts(displayModel.secondaryParts)}
            </span>
          ) : null}
      </span>
      {onClose ? (
        <button
          type="button"
          className="gn-v2-tab-close"
          aria-label={t('tab_manager.close_aria', { title: displayTitle })}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
        >
          <CloseOutlined />
        </button>
      ) : null}
    </span>
  );

  // 页签悬停信息框（service-detail 才有意义）：复用服务列表同一组件，按字段非空才显，避免大卡片遮挡。
  const serviceEntry = tab.type === 'service-detail'
    ? useServiceRegistryStore.getState().services.find((entry) => entry.name === (tab.serviceName || tab.title))
    : undefined;
  const serviceGroupName = serviceEntry
    ? useServiceRegistryStore.getState().groups.find((group) => group.id === serviceEntry.groupId)?.name
    : undefined;
  const hoverWrappedLabel = serviceEntry
    ? <ServiceHoverTooltip service={serviceEntry} groupName={serviceGroupName}>{labelNode}</ServiceHoverTooltip>
    : labelNode;

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['contextMenu']}
      onOpenChange={handleTabMenuOpenChange}
      rootClassName={'gn-v2-tab-context-menu-popup'}
      popupRender={(menu) => renderV2ActionMenuPopup(menu, true, {
        title: displayTitle,
        showHeader: false,
      })}
    >
      {hoverWrappedLabel}
    </Dropdown>
  );
};

type DraggableTabNodeProps = {
  node: React.ReactElement;
};

const TAB_DRAG_INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="menuitem"]',
  '[data-tab-drag-ignore="true"]',
  '.ant-dropdown-menu',
  '.ant-tabs-tab-remove',
  '.gn-v2-tab-close',
].join(', ');

export const shouldActivateTabDragPointer = (event: {
  button: number;
  ctrlKey?: boolean;
  isPrimary?: boolean;
  target: EventTarget | null;
}): boolean => {
  if (event.button !== 0 || event.ctrlKey || event.isPrimary === false) return false;
  const target = event.target as { closest?: (selector: string) => Element | null } | null;
  return typeof target?.closest !== 'function'
    || target.closest(TAB_DRAG_INTERACTIVE_SELECTOR) === null;
};

export const handleTabDragPointerDown = (
  event: React.PointerEvent<HTMLElement>,
  handlePointerDown?: React.PointerEventHandler<HTMLElement>,
): void => {
  if (!shouldActivateTabDragPointer(event)) return;
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is not exposed by every embedded WebView build.
  }
  handlePointerDown?.(event);
};

type TabDetachDragGuardOptions = {
  windowTarget: EventTarget;
  captureTarget: EventTarget | null;
  rootClassList: Pick<DOMTokenList, 'add' | 'remove'>;
  pointerId: number | null;
  isCurrent: () => boolean;
  onTerminalPointer: (pointer: NativeDetachTerminalPointer) => void;
  onInterrupted: () => void;
  cancelDndDrag: () => void;
};

export const installTabDetachDragGuards = ({
  windowTarget,
  captureTarget,
  rootClassList,
  pointerId,
  isCurrent,
  onTerminalPointer,
  onInterrupted,
  cancelDndDrag,
}: TabDetachDragGuardOptions): (() => void) => {
  let removed = false;
  const matchesPointer = (event: PointerEvent) => (
    pointerId === null || event.pointerId === pointerId
  );
  const interrupt = () => {
    if (removed || !isCurrent()) return;
    try {
      onInterrupted();
    } finally {
      cancelDndDrag();
    }
  };
  const recordTerminalPointer = (event: Event) => {
    const pointerEvent = event as PointerEvent;
    if (removed || !isCurrent() || !matchesPointer(pointerEvent)) return;
    onTerminalPointer({
      type: event.type === 'pointercancel' ? 'pointercancel' : 'pointerup',
      clientX: pointerEvent.clientX,
      clientY: pointerEvent.clientY,
      screenX: pointerEvent.screenX,
      screenY: pointerEvent.screenY,
    });
  };
  const handlePointerMove = (event: Event) => {
    const pointerEvent = event as PointerEvent;
    if (matchesPointer(pointerEvent) && pointerEvent.buttons === 0) {
      interrupt();
    }
  };
  const handleLostPointerCapture = (event: Event) => {
    if (matchesPointer(event as PointerEvent)) {
      interrupt();
    }
  };
  const handleWindowBlur = () => interrupt();

  windowTarget.addEventListener('pointermove', handlePointerMove, true);
  windowTarget.addEventListener('pointerup', recordTerminalPointer, true);
  windowTarget.addEventListener('pointercancel', recordTerminalPointer, true);
  windowTarget.addEventListener('blur', handleWindowBlur);
  captureTarget?.addEventListener('lostpointercapture', handleLostPointerCapture);
  rootClassList.add('gn-workbench-tab-detaching');

  return () => {
    if (removed) return;
    removed = true;
    windowTarget.removeEventListener('pointermove', handlePointerMove, true);
    windowTarget.removeEventListener('pointerup', recordTerminalPointer, true);
    windowTarget.removeEventListener('pointercancel', recordTerminalPointer, true);
    windowTarget.removeEventListener('blur', handleWindowBlur);
    captureTarget?.removeEventListener('lostpointercapture', handleLostPointerCapture);
    if (captureTarget && pointerId !== null) {
      const pointerCaptureTarget = captureTarget as HTMLElement;
      try {
        if (pointerCaptureTarget.hasPointerCapture?.(pointerId)) {
          pointerCaptureTarget.releasePointerCapture(pointerId);
        }
      } catch {
        // Pointer capture may already be gone after blur, cancellation, or unmount.
      }
    }
    rootClassList.remove('gn-workbench-tab-detaching');
  };
};

const DraggableTabNode: React.FC<DraggableTabNodeProps> = ({ node }) => {
  const tabId = String(node.key || '').trim();
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tabId });
  const style: React.CSSProperties = {
    ...(node.props.style || {}),
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
    opacity: isDragging ? 0.88 : 1,
    // 光标全程普通箭头（与浏览器 tab 一致，用户反馈：手/拳头都去掉）；拖拽走指针事件，不依赖光标
    cursor: 'default',
    touchAction: 'none',
    zIndex: isDragging ? 2 : node.props.style?.zIndex,
  };
  const handlePointerDown = listeners?.onPointerDown as React.PointerEventHandler<HTMLElement> | undefined;

  return React.cloneElement(node, {
    ref: setNodeRef,
    style,
    ...listeners,
    onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
      handleTabDragPointerDown(event, handlePointerDown),
    className: `${node.props.className || ''} tab-dnd-node${isDragging ? ' is-dragging' : ''}`,
  });
};

type TabManagerProps = {
  onAddService?: () => void;
  onFocusSidebarSearch?: () => void;
};

const TabManager: React.FC<TabManagerProps> = React.memo<TabManagerProps>(({ onAddService }) => {
  const tabs = useWorkbenchTabs();
  const detachedWorkbenchWindows = useStore(state => state.detachedWorkbenchWindows);
  const theme = useStore(state => state.theme);
  const appearance = useStore(state => state.appearance);
  const activeTabId = useStore(state => state.activeTabId);
  const setActiveTab = useStore(state => state.setActiveTab);
  const closeTab = useStore(state => state.closeTab);
  const moveTab = useStore(state => state.moveTab);
  const detachWorkbenchTab = useStore(state => state.detachWorkbenchTab);
  const detachedTabIdSet = useMemo(
    () => new Set(detachedWorkbenchWindows.map((windowState) => windowState.tabId)),
    [detachedWorkbenchWindows],
  );
  const dockedTabs = useMemo(
    () => tabs.filter((tab) => !detachedTabIdSet.has(tab.id)),
    [detachedTabIdSet, tabs],
  );
  const tabsNavBorderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
  const tabWorkbenchRef = useRef<HTMLDivElement>(null);
  const [v2TabWidth, setV2TabWidth] = useState(V2_WORKBENCH_TAB_MAX_WIDTH);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [detachDragPreview, setDetachDragPreview] = useState<DetachDragPreviewState | null>(null);
  const detachDragSessionRef = useRef<{
    tabId: string;
    title: string;
    startX: number;
    startY: number;
    startScreenX: number;
    startScreenY: number;
    pointerId: number | null;
    captureTarget: HTMLElement | null;
    terminalPointer: NativeDetachTerminalPointer | null;
    removeDragGuards: (() => void) | null;
  } | null>(null);
  const suppressClickUntilRef = useRef<number>(0);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const hasTabs = tabs.length > 0;
  const hasDockedTabs = dockedTabs.length > 0;
  useLayoutEffect(() => {
    if (dockedTabs.length === 0) {
      setV2TabWidth(V2_WORKBENCH_TAB_MAX_WIDTH);
      return;
    }

    const target = tabWorkbenchRef.current;
    if (!target) return;

    const updateWidth = (availableWidth: number) => {
      const nextWidth = resolveV2WorkbenchTabWidth(availableWidth, dockedTabs.length);
      setV2TabWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
    };
    const measure = () => updateWidth(target.getBoundingClientRect().width);

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const scheduler = createSidebarResizeAwareFrameScheduler(measure);
    const observer = new ResizeObserver(() => scheduler.schedule());
    observer.observe(target);
    return () => {
      observer.disconnect();
      scheduler.dispose();
    };
  }, [dockedTabs.length]);

  const tabWorkbenchStyle = buildTabWorkbenchStyle(
    v2TabWidth,
    appearance.tabEnvironmentAccentThickness,
  );
  const detachTabToWindow = useCallback((tabId: string, preferred?: { x?: number; y?: number; width?: number; height?: number }) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (tab && isMainWindowBoundWorkbenchTab(tab)) {
      // 设置中心的 UI 与状态挂在主 App 桥上，独立 OS 窗口（独立 webview）读不到，
      // 改弹主窗口内浮层承载。
      detachWorkbenchTab(tabId, preferred);
      return;
    }
    void openNativeWorkbenchTabWindow(tabId, preferred).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }, [detachWorkbenchTab, tabs]);
  const dockedActiveTabId = useMemo(() => {
    return resolveDockedActiveTabId(tabs, activeTabId, detachedWorkbenchWindows);
  }, [activeTabId, detachedWorkbenchWindows, tabs]);
  const pendingCloseTabIdsRef = useRef<Set<string>>(new Set());

  const onChange = (newActiveKey: string) => {
    setActiveTab(newActiveKey);
  };

  const closeTabsDirectly = useCallback((targetIds: string[], closeConfirmedTabs: () => void) => {
    const uniqueIds = Array.from(new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (uniqueIds.length === 0) return;
    const dedupeKey = uniqueIds.slice().sort().join('\n');
    if (pendingCloseTabIdsRef.current.has(dedupeKey)) return;
    pendingCloseTabIdsRef.current.add(dedupeKey);
    closeConfirmedTabs();
    pendingCloseTabIdsRef.current.delete(dedupeKey);
  }, []);

  const requestCloseActiveWorkspaceTab = useCallback(() => {
    if (!dockedActiveTabId) return;
    closeTabsDirectly([dockedActiveTabId], () => closeTab(dockedActiveTabId));
  }, [closeTab, closeTabsDirectly, dockedActiveTabId]);

  useEffect(() => {
    window.addEventListener(CLOSE_ACTIVE_WORKSPACE_TAB_EVENT, requestCloseActiveWorkspaceTab);
    return () => {
      window.removeEventListener(CLOSE_ACTIVE_WORKSPACE_TAB_EVENT, requestCloseActiveWorkspaceTab);
    };
  }, [requestCloseActiveWorkspaceTab]);

  useEffect(() => {
    const handleRequestedClose = (event: Event) => {
      const tabIds = (event as CustomEvent<{ tabIds?: unknown }>).detail?.tabIds;
      if (!Array.isArray(tabIds)) return;
      const normalizedTabIds = tabIds.map((id) => String(id || '').trim()).filter(Boolean);
      closeTabsDirectly(normalizedTabIds, () => {
        closeConfirmedWorkbenchTabs(normalizedTabIds, closeTab);
      });
    };
    window.addEventListener(REQUEST_CLOSE_WORKBENCH_TABS_EVENT, handleRequestedClose);
    return () => window.removeEventListener(REQUEST_CLOSE_WORKBENCH_TABS_EVENT, handleRequestedClose);
  }, [closeTab, closeTabsDirectly]);

  const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'remove') {
      const id = String(targetKey || '');
      closeTabsDirectly([id], () => closeTab(id));
    }
  };

  const dispatchDndPointerCancel = useCallback(() => {
    document.dispatchEvent(new Event('pointercancel', {
      bubbles: true,
      cancelable: true,
    }));
  }, []);

  const clearDetachDragSession = useCallback(() => {
    const session = detachDragSessionRef.current;
    session?.removeDragGuards?.();
    if (session?.captureTarget && session.pointerId !== null) {
      try {
        if (session.captureTarget.hasPointerCapture?.(session.pointerId)) {
          session.captureTarget.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Pointer capture may already have been released by the native WebView.
      }
    }
    detachDragSessionRef.current = null;
    setDetachDragPreview(null);
    document.documentElement.classList.remove('gn-workbench-tab-detaching');
  }, []);

  useEffect(() => () => {
    const hadActiveSession = detachDragSessionRef.current !== null;
    clearDetachDragSession();
    if (hadActiveSession) {
      dispatchDndPointerCancel();
    }
  }, [clearDetachDragSession, dispatchDndPointerCancel]);

  const handleDragStart = (event: DragStartEvent) => {
    clearDetachDragSession();
    const sourceId = String(event.active.id || '').trim();
    setDraggingTabId(sourceId || null);
    const tab = dockedTabs.find((item) => item.id === sourceId);
    const displayModel = tab
      ? buildTabDisplayModel(tab, appearance.tabDisplay, t)
      : null;
    const title = displayModel?.fullTitle || tab?.title || t('tab_manager.detached.title_fallback');
    const pointerEvent = event.activatorEvent as PointerEvent | MouseEvent | undefined;
    const startX = typeof pointerEvent?.clientX === 'number' ? pointerEvent.clientX : 0;
    const startY = typeof pointerEvent?.clientY === 'number' ? pointerEvent.clientY : 0;
    const startScreenX = typeof pointerEvent?.screenX === 'number'
      ? pointerEvent.screenX
      : window.screenX + startX;
    const startScreenY = typeof pointerEvent?.screenY === 'number'
      ? pointerEvent.screenY
      : window.screenY + startY;
    const pointerId = typeof (pointerEvent as PointerEvent | undefined)?.pointerId === 'number'
      ? (pointerEvent as PointerEvent).pointerId
      : null;
    const activatorTarget = pointerEvent?.target;
    const captureTarget = typeof Element !== 'undefined' && activatorTarget instanceof Element
      ? activatorTarget.closest<HTMLElement>('.tab-dnd-node')
      : null;
    const session = sourceId
      ? {
          tabId: sourceId,
          title,
          startX,
          startY,
          startScreenX,
          startScreenY,
          pointerId,
          captureTarget,
          terminalPointer: null as NativeDetachTerminalPointer | null,
          removeDragGuards: null as (() => void) | null,
        }
      : null;
    detachDragSessionRef.current = session;
    if (session) {
      session.removeDragGuards = installTabDetachDragGuards({
        windowTarget: window,
        captureTarget: session.captureTarget,
        rootClassList: document.documentElement.classList,
        pointerId: session.pointerId,
        isCurrent: () => detachDragSessionRef.current === session,
        onTerminalPointer: (terminalPointer) => {
          session.terminalPointer = terminalPointer;
        },
        onInterrupted: () => {
          setDraggingTabId(null);
          clearDetachDragSession();
        },
        cancelDndDrag: dispatchDndPointerCancel,
      });
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const session = detachDragSessionRef.current;
    if (!session) return;
    const deltaX = Number(event.delta?.x || 0);
    const deltaY = Number(event.delta?.y || 0);
    setDetachDragPreview(buildDetachDragPreviewState({
      title: session.title,
      clientX: session.startX + deltaX,
      clientY: session.startY + deltaY,
      deltaY,
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const sourceId = String(event.active.id || '').trim();
    const targetId = String(event.over?.id || '').trim();
    const deltaX = Number(event.delta?.x || 0);
    const deltaY = Number(event.delta?.y || 0);
    const session = detachDragSessionRef.current;
    const release = resolveNativeDetachDragRelease({
      startClientX: session?.startX ?? 0,
      startClientY: session?.startY ?? 0,
      startScreenX: session?.startScreenX ?? window.screenX,
      startScreenY: session?.startScreenY ?? window.screenY,
      fallbackDeltaX: deltaX,
      fallbackDeltaY: deltaY,
      terminalPointer: session?.terminalPointer,
    });
    setDraggingTabId(null);
    clearDetachDragSession();
    if (!sourceId) {
      return;
    }
    const releasedOutsideHost = shouldDetachAtScreenPoint(release.screenX, release.screenY, {
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth || window.innerWidth,
      height: window.outerHeight || window.innerHeight,
    });
    if (shouldDetachTabByDrag(release.deltaY, targetId || null) || releasedOutsideHost) {
      suppressClickUntilRef.current = Date.now() + 120;
      const preferred = resolveNativeDetachPreferredBounds(release.screenX, release.screenY);
      detachTabToWindow(sourceId, preferred);
      return;
    }
    if (!targetId || sourceId === targetId) {
      return;
    }
    suppressClickUntilRef.current = Date.now() + 120;
    moveTab(sourceId, targetId);
  };

  const handleDragCancel = () => {
    const session = detachDragSessionRef.current;
    const release = resolveNativeDetachDragRelease({
      startClientX: session?.startX ?? 0,
      startClientY: session?.startY ?? 0,
      startScreenX: session?.startScreenX ?? window.screenX,
      startScreenY: session?.startScreenY ?? window.screenY,
      fallbackDeltaX: 0,
      fallbackDeltaY: 0,
      terminalPointer: session?.terminalPointer,
    });
    const shouldDetach = Boolean(session) && shouldDetachAfterNativePointerCancel(release, {
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth || window.innerWidth,
      height: window.outerHeight || window.innerHeight,
    });
    setDraggingTabId(null);
    clearDetachDragSession();
    if (shouldDetach && session) {
      suppressClickUntilRef.current = Date.now() + 120;
      detachTabToWindow(
        session.tabId,
        resolveNativeDetachPreferredBounds(release.screenX, release.screenY),
      );
    }
  };

  const tabIds = useMemo(() => dockedTabs.map((tab) => tab.id), [dockedTabs]);
  const hasDoubleLineTabLabel = useMemo(() => (
    dockedTabs.some((tab) => {
      const displayModel = buildTabDisplayModel(tab, appearance.tabDisplay, t);
      return displayModel.layout === 'double' && Boolean(displayModel.secondaryText);
    })
  ), [appearance.tabDisplay, dockedTabs]);

  const renderTabBar: TabsProps['renderTabBar'] = (tabBarProps, DefaultTabBar) => (
    <DefaultTabBar {...tabBarProps}>
      {(node) => <DraggableTabNode key={node.key} node={node} />}
    </DefaultTabBar>
  );

  const items = useMemo(() => dockedTabs.map((tab, index) => {
    const displayModel = buildTabDisplayModel(tab, appearance.tabDisplay, t);
    const displayTitle = displayModel.fullTitle;

    const menuItems: MenuProps['items'] = [
      {
        key: 'tab-display-settings',
        icon: <SettingOutlined />,
        label: t('tab_manager.menu.tab_display_settings'),
        onClick: openTabDisplaySettings,
      },
      {
        key: 'open-in-window',
        icon: <ExportOutlined />,
        label: t('tab_manager.menu.open_in_window'),
        onClick: () => detachTabToWindow(tab.id),
      },
      { type: 'divider' },
      {
        key: 'close-other',
        icon: <CloseCircleOutlined />,
        label: t('tab_manager.menu.close_other'),
        disabled: tabs.length <= 1,
        onClick: () => {
          const targetIds = getCloseOtherTabIds(tabs, tab.id);
          closeTabsDirectly(targetIds, () => closeConfirmedWorkbenchTabs(targetIds, closeTab));
        },
      },
      {
        key: 'close-left',
        icon: <ArrowLeftOutlined />,
        label: t('tab_manager.menu.close_left'),
        disabled: index === 0,
        onClick: () => {
          const targetIds = getCloseTabsToLeftIds(dockedTabs, tab.id);
          closeTabsDirectly(targetIds, () => closeConfirmedWorkbenchTabs(targetIds, closeTab));
        },
      },
      {
        key: 'close-right',
        icon: <ArrowRightOutlined />,
        label: t('tab_manager.menu.close_right'),
        disabled: index === dockedTabs.length - 1,
        onClick: () => {
          const targetIds = getCloseTabsToRightIds(dockedTabs, tab.id);
          closeTabsDirectly(targetIds, () => closeConfirmedWorkbenchTabs(targetIds, closeTab));
        },
      },
      {
        key: 'close-all',
        icon: <CloseOutlined />,
        label: t('tab_manager.menu.close_all'),
        disabled: tabs.length === 0,
        onClick: () => {
          const targetIds = tabs.map((item) => item.id);
          closeTabsDirectly(targetIds, () => closeConfirmedWorkbenchTabs(targetIds, closeTab));
        },
      },
    ];

    return {
      label: (
        <SortableTabLabel
          tab={tab}
          displayModel={displayModel}
          displayTitle={displayTitle}
          menuItems={menuItems}
          onClose={() => closeTabsDirectly([tab.id], () => closeTab(tab.id))}
        />
      ),
      key: tab.id,
      closable: false,
      children: <WorkbenchTabContent tab={tab} />,
    };
  }), [dockedTabs, tabs, appearance.tabDisplay, closeTab, closeTabsDirectly, detachTabToWindow]);

  const detailOpen = useServiceDetailStore((state) => state.open);

  const ServiceHomeElement = (
    <ServiceHome onAddService={onAddService} onMore={detailOpen} />
  );

  return (
    <div
      ref={tabWorkbenchRef}
      className={`${TAB_WORKBENCH_CLASS_NAME} gn-v2-tab-workbench`}
      style={tabWorkbenchStyle}
    >
        <style>{`
            .${TAB_WORKBENCH_CLASS_NAME} {
              height: 100%;
              flex: 1 1 auto;
              min-height: 0;
              min-width: 0;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            .main-tabs {
              height: 100%;
              flex: 1 1 auto;
              min-height: 0;
              min-width: 0;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            .main-tabs .ant-tabs-nav {
              flex: 0 0 auto;
              margin: 0;
            }
            .main-tabs .ant-tabs-content-holder {
              flex: 1 1 auto;
              min-height: 0;
              min-width: 0;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .main-tabs .ant-tabs-content {
              flex: 1 1 auto;
              min-height: 0;
              min-width: 0;
              display: flex;
              flex-direction: column;
            }
            .main-tabs .ant-tabs-tabpane {
              flex: 1 1 auto;
              min-height: 0;
              min-width: 0;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            .main-tabs .ant-tabs-tabpane > div {
              flex: 1 1 auto;
              min-height: 0;
              min-width: 0;
            }
            .main-tabs .ant-tabs-tabpane-hidden {
              display: none !important;
            }
            .main-tabs .ant-tabs-nav::before {
                border-bottom: 1px solid ${tabsNavBorderColor} !important;
            }
            .main-tabs .ant-tabs-tab {
              transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 120ms ease;
            }
            .main-tabs .tab-dnd-label {
              position: relative;
              user-select: none;
              -webkit-user-select: none;
              display: inline-flex;
              align-items: center;
              gap: 7px;
              max-width: 100%;
            }
            .main-tabs .tab-title-text {
              min-width: 0;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .main-tabs .tab-dnd-node.is-dragging,
            .main-tabs .tab-dnd-node.is-dragging .tab-dnd-label {
              cursor: default !important;
            }
            body[data-theme='dark'] .main-tabs .ant-tabs-tab-btn:focus-visible {
              outline: none !important;
              border-radius: 6px;
              box-shadow: 0 0 0 2px rgba(255, 214, 102, 0.72);
              background: rgba(255, 214, 102, 0.16);
            }
            body[data-theme='light'] .main-tabs .ant-tabs-tab-btn:focus-visible {
              outline: none !important;
              border-radius: 6px;
              box-shadow: 0 0 0 2px rgba(9, 109, 217, 0.32);
              background: rgba(9, 109, 217, 0.08);
            }
            /* v2/IDEA 风 active：背景融入标签栏、无边框（主题高亮条由 v2-theme.css 的 inset 底边承担） */
            body[data-ui-version='v2'] .main-tabs .ant-tabs-tab.ant-tabs-tab-active {
              background: var(--gn-bg-panel) !important;
              border-color: transparent !important;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-tooltip .ant-tooltip-inner {
              min-width: 260px;
              padding: 0;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-tooltip {
              pointer-events: auto;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-card {
              --gn-v2-tab-hover-grid-columns: 56px minmax(0, 1fr);
              display: flex;
              flex-direction: column;
              gap: 8px;
              padding: 10px;
              color: var(--gn-fg-2);
              cursor: text;
              user-select: text;
              -webkit-user-select: text;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-card * {
              user-select: text;
              -webkit-user-select: text;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-head {
              display: grid;
              grid-template-columns: var(--gn-v2-tab-hover-grid-columns);
              align-items: start;
              gap: 8px;
              min-width: 0;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-head > span {
              justify-self: start;
              padding: 2px 6px;
              border-radius: 5px;
              background: var(--gn-bg-active);
              color: var(--gn-accent-2);
              font-family: var(--gn-font-mono);
              font-size: 10px;
              font-weight: 700;
              line-height: 14px;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-head > strong {
              min-width: 0;
              overflow-wrap: anywhere;
              color: var(--gn-fg-1);
              font-size: var(--gn-font-size-sm, 12px);
              font-weight: 700;
              line-height: 18px;
              white-space: normal;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-rows {
              display: grid;
              gap: 5px;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-row {
              display: grid;
              grid-template-columns: var(--gn-v2-tab-hover-grid-columns);
              align-items: start;
              gap: 8px;
              font-size: var(--gn-font-size-sm, 12px);
              line-height: 18px;
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-row > span {
              color: var(--gn-fg-5);
            }
            body[data-ui-version='v2'] .gn-v2-tab-hover-row > strong {
              min-width: 0;
              overflow-wrap: anywhere;
              color: var(--gn-fg-2);
              font-weight: 600;
            }
            html.gn-workbench-tab-detaching,
            html.gn-workbench-tab-detaching body,
            html.gn-workbench-tab-detaching * {
              user-select: none !important;
              -webkit-user-select: none !important;
            }
        `}</style>
        {!hasTabs ? (
          ServiceHomeElement
        ) : !hasDockedTabs ? (
          // All tabs are floating: keep empty docked area; floating host still shows content.
          <div className="gn-detached-only-workbench" style={{ flex: 1, minHeight: 0 }} />
        ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
            <Tabs
                className={`main-tabs gn-v2-main-tabs${hasDoubleLineTabLabel ? ' gn-v2-main-tabs-double' : ''}`}
                type="editable-card"
                onChange={(newActiveKey) => {
                  if (Date.now() < suppressClickUntilRef.current) return;
                  onChange(newActiveKey);
                }}
                activeKey={dockedActiveTabId || undefined}
                onEdit={onEdit}
                items={items}
                hideAdd
                renderTabBar={renderTabBar}
            />
          </SortableContext>
        </DndContext>
        )}
        <DetachDragPreview
          preview={detachDragPreview}
          darkMode={theme === 'dark'}
          readyHint={t('tab_manager.menu.open_in_window')}
        />
    </div>
  );
});

export default TabManager;
