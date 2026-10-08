import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ManagedServiceEntry } from '../serviceRegistryStore';
import { APP_POPUP_Z_INDEX } from '../utils/overlayZIndex';

export interface ServiceHoverRow {
  label: string;
  value: string;
}

export interface MouseFollowCardState {
  x: number;
  y: number;
  rows: ServiceHoverRow[];
}

/** 信息框字段：有值才显示、没有就不显示（用户约定）。服务列表行与 service-detail 页签共用。
 *  标签统一四字（2026-10-08 用户指定），配合 CSS 标签右对齐形成整齐栅格。 */
export const buildServiceHoverRows = (
  service: ManagedServiceEntry,
  groupName?: string,
): ServiceHoverRow[] => [
  { label: '显示名称', value: (service.displayName || '').trim() },
  { label: '服务名称', value: (service.name || '').trim() },
  { label: '服务类型', value: (service.serviceType || '').trim() },
  { label: '所属分组', value: (groupName || '').trim() },
  { label: '部署路径', value: (service.programFile || '').trim() },
  { label: '日志目录', value: (service.logDir || '').trim() },
].filter((row) => row.value);

/** 卡片内容（纯展示）；定位与显隐由 useMouseFollowServiceCard 管理。 */
export const ServiceHoverCardContent: React.FC<{ rows: ServiceHoverRow[] }> = ({ rows }) => (
  <div className="gn-service-hover-card-body">
    {rows.map((row) => (
      <div className="gn-service-hover-row" key={row.label}>
        <span className="gn-service-hover-label">{row.label}</span>
        <span className="gn-service-hover-value">{row.value}</span>
      </div>
    ))}
  </div>
);

/** 视口边界修正：右/下溢出时向左/上翻转（卡片尺寸用上限估算，宁早翻不溢出）。 */
const resolveCardPosition = (x: number, y: number): { left: number; top: number } => {
  const offset = 14;
  const estimatedW = 340;
  const estimatedH = 200;
  const left = x + offset + estimatedW > window.innerWidth
    ? Math.max(8, x - offset - estimatedW)
    : x + offset;
  const top = y + offset + estimatedH > window.innerHeight
    ? Math.max(8, y - offset - estimatedH)
    : y + offset;
  return { left, top };
};

/** 跟随鼠标的服务信息卡（fixed + portal，pointer-events:none 不挡下方交互）。 */
export const MouseFollowServiceCard: React.FC<{ card: MouseFollowCardState | null }> = ({ card }) => {
  if (!card || typeof document === 'undefined') return null;
  const { left, top } = resolveCardPosition(card.x, card.y);
  return createPortal(
    <div
      className="gn-service-hover-card"
      style={{ left, top, zIndex: APP_POPUP_Z_INDEX }}
    >
      <ServiceHoverCardContent rows={card.rows} />
    </div>,
    document.body,
  );
};

const HOVER_SHOW_DELAY_MS = 300;

/**
 * 跟随鼠标悬浮卡的状态机（antd Tooltip 位置固定、不随鼠标移动，故自实现）：
 * enter 记录目标并启动 300ms 延迟；move 用 rAF 合并高频坐标更新；
 * leave/隐藏时清计时器。tab 与服务列表委托两处共用。
 */
export const useMouseFollowServiceCard = () => {
  const [card, setCard] = useState<MouseFollowCardState | null>(null);
  const pendingRef = useRef<MouseFollowCardState | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const enter = useCallback((x: number, y: number, rows: ServiceHoverRow[]) => {
    clearTimer();
    pendingRef.current = { x, y, rows };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (pendingRef.current) {
        setCard(pendingRef.current);
      }
    }, HOVER_SHOW_DELAY_MS);
  }, [clearTimer]);

  const move = useCallback((x: number, y: number) => {
    if (pendingRef.current) {
      pendingRef.current = { ...pendingRef.current, x, y };
    }
    // rAF 合并：一帧至多一次 setState，避免 mousemove 高频重渲
    if (!rafRef.current) {
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        setCard((prev) => (prev
          ? { ...prev, x, y }
          : prev));
      });
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setCard(null);
  }, [clearTimer]);

  useEffect(() => () => {
    clearTimer();
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
  }, [clearTimer]);

  return { enter, move, hide, card };
};

interface ServiceHoverTooltipProps {
  service: ManagedServiceEntry;
  groupName?: string;
  /** 必须是可 cloneElement 的单元素（事件直接合并到元素上，不额外包 DOM 破坏 flex 布局）。 */
  children: React.ReactElement;
}

/**
 * service-detail 页签用的跟随鼠标信息框：把 enter/move/leave 事件合并进 children，
 * 卡片 portal 到 body。服务列表侧走容器委托（见 ServiceTreeSidebar），共用同一卡片渲染。
 */
export const ServiceHoverTooltip: React.FC<ServiceHoverTooltipProps> = ({
  service,
  groupName,
  children,
}) => {
  const { enter, move, hide, card } = useMouseFollowServiceCard();
  const rows = buildServiceHoverRows(service, groupName);
  if (rows.length === 0) {
    return children;
  }
  const withHover = React.cloneElement(children, {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      enter(event.clientX, event.clientY, rows);
    },
    onMouseMove: (event: React.MouseEvent<HTMLElement>) => {
      move(event.clientX, event.clientY);
    },
    onMouseLeave: hide,
  });
  return (
    <>
      {withHover}
      <MouseFollowServiceCard card={card} />
    </>
  );
};
