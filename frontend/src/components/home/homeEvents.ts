import { create } from 'zustand';

/** 事件圆点的四种颜色语义：运行（绿）/ 异常（红）/ 告警（黄）/ 信息（蓝）。 */
export type HomeEventLevel = 'run' | 'err' | 'warn' | 'info';

export interface HomeEvent {
  id: string;
  /** 事件时间（epoch 毫秒） */
  at: number;
  level: HomeEventLevel;
  /** SCM 服务名 */
  name?: string;
  /** 服务展示名（渲染时加粗，不进模板） */
  service: string;
  /** i18n 键；文案是接在服务名后的后缀句 */
  key: string;
  params?: Record<string, string>;
}

/** 会话级事件上限：超出后丢弃最旧的，避免长时间挂机内存增长。 */
export const MAX_HOME_EVENTS = 50;

let eventSeq = 0;

interface HomeEventsState {
  events: HomeEvent[];
  pushEvent: (event: Omit<HomeEvent, 'id'>) => void;
  clearEvents: () => void;
}

/** 首页"最近事件"卡的数据源；只在当前会话内有效，重启应用后清空。 */
export const useHomeEventsStore = create<HomeEventsState>((set) => ({
  events: [],
  pushEvent: (event) =>
    set((state) => ({
      events: [{ ...event, id: `evt-${event.at}-${eventSeq++}` }, ...state.events].slice(0, MAX_HOME_EVENTS),
    })),
  clearEvents: () => set({ events: [] }),
}));

export interface ServiceStateSnapshot {
  name: string;
  displayName: string;
  state: string;
}

const PENDING_STATES = new Set(['StartPending', 'StopPending', 'ContinuePending', 'PausePending']);

export function isPendingState(state: string): boolean {
  return PENDING_STATES.has(state);
}

export interface HomeEventDraft {
  at: number;
  level: HomeEventLevel;
  /** SCM 服务名；用于手动操作后的事件抑制，不参与渲染 */
  name: string;
  service: string;
  key: string;
  params?: Record<string, string>;
}

/**
 * 对比两次轮询的服务状态，产出事件草稿（写入 store 前不分配 id）。
 * 首次采样（prev 无该服务）不记；进入 pending 的迁移不记（中间态噪音）；
 * 从 pending 进入终态要记（StartPending → Stopped 意味着启动失败，值得上时间线）。
 */
export function diffServiceStates(
  prev: ReadonlyMap<string, string>,
  next: ReadonlyArray<ServiceStateSnapshot>,
  now: number,
): HomeEventDraft[] {
  const drafts: HomeEventDraft[] = [];
  next.forEach((entry) => {
    const before = prev.get(entry.name);
    if (!before || before === entry.state) return;
    if (isPendingState(entry.state)) return;
    if (entry.state === 'Running') {
      drafts.push({ at: now, level: 'run', name: entry.name, service: entry.displayName, key: 'home.events.started' });
    } else if (entry.state === 'Stopped') {
      drafts.push({ at: now, level: 'info', name: entry.name, service: entry.displayName, key: 'home.events.stopped' });
    } else {
      drafts.push({
        at: now,
        level: 'err',
        name: entry.name,
        service: entry.displayName,
        key: 'home.events.abnormal',
        params: { state: entry.state },
      });
    }
  });
  return drafts;
}
