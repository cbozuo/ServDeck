import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { ControlWindowsService, ListWindowsServices, SampleServiceMetrics } from '../../../wailsjs/go/app/App';
import { useI18n } from '../../i18n/provider';
import type { I18nParams } from '../../i18n/types';
import type { ManagedServiceEntry } from '../../serviceRegistryStore';
import { diffServiceStates, useHomeEventsStore } from './homeEvents';

const POLL_MS = 2000;
const STATE_FALLBACK = 'Unknown';
/** 手动操作成功后，抑制该服务的轮询 diff 事件，避免与操作事件重复。 */
const MANUAL_EVENT_SUPPRESS_MS = 15000;

export type ServiceControlAction = 'start' | 'stop' | 'restart';

export interface ServiceRuntimeMetrics {
  /** 相邻两次采样的进程 CPU 百分比（可能超 100，多核）；null = 首轮还没有差值 */
  cpuPct: number | null;
  memBytes: number;
}

export interface ServiceRuntimeRow {
  name: string;
  displayName: string;
  serviceType: string;
  state: string;
  autoStart: boolean;
  /** 仅 Running 时有值 */
  metrics: ServiceRuntimeMetrics | null;
  /** 会话内观察到的最后一次停止时间（epoch ms）；null = 会话内未观察到 */
  lastStoppedAt: number | null;
}

export interface ServiceRuntimeCounts {
  all: number;
  running: number;
  stopped: number;
  error: number;
  auto: number;
}

interface ServiceMetricPayload {
  name: string;
  state: string;
  pid: number;
  cpuTotal: number;
  memBytes: number;
}

interface StaticServiceInfo {
  displayName: string;
  startType: string;
}

export interface ServiceRuntime {
  rows: ServiceRuntimeRow[];
  counts: ServiceRuntimeCounts;
  /** 控制动作进行中的服务（name -> action），按钮据此禁用 */
  pendingOps: Record<string, ServiceControlAction>;
  controlService: (name: string, action: ServiceControlAction) => Promise<void>;
  refreshNow: () => void;
}

/** 首页服务列表的运行时数据：每 2 秒采样纳管服务状态与进程指标，驱动事件流与行内启停操作。 */
export function useServiceRuntime(services: ManagedServiceEntry[]): ServiceRuntime {
  const { t } = useI18n();
  const pushEvent = useHomeEventsStore((state) => state.pushEvent);

  const [rows, setRows] = useState<ServiceRuntimeRow[]>([]);
  const [pendingOps, setPendingOps] = useState<Record<string, ServiceControlAction>>({});

  const servicesRef = useRef(services);
  servicesRef.current = services;
  const staticInfoRef = useRef(new Map<string, StaticServiceInfo>());
  const prevSampleRef = useRef(new Map<string, { cpuTotal: number; at: number }>());
  const prevStateRef = useRef(new Map<string, string>());
  const lastStoppedRef = useRef(new Map<string, number>());
  const suppressUntilRef = useRef(new Map<string, number>());

  const namesKey = useMemo(() => services.map((entry) => entry.name).join('\n'), [services]);

  const displayNameOf = useCallback((entry: ManagedServiceEntry): string => {
    const info = staticInfoRef.current.get(entry.name);
    return entry.displayName || info?.displayName || entry.name;
  }, []);

  const pollOnce = useCallback(async () => {
    const current = servicesRef.current;
    if (current.length === 0) {
      setRows([]);
      prevSampleRef.current.clear();
      prevStateRef.current.clear();
      return;
    }
    try {
      const result = await SampleServiceMetrics(current.map((entry) => entry.name));
      if (!result.success) {
        return;
      }
      const samples = (result.data?.services ?? []) as ServiceMetricPayload[];
      const now = Date.now();
      const sampleByName = new Map(samples.map((sample) => [sample.name, sample]));
      const displayNameByName = new Map(current.map((entry) => [entry.name, displayNameOf(entry)]));

      const drafts = diffServiceStates(
        prevStateRef.current,
        samples.map((sample) => ({
          name: sample.name,
          displayName: displayNameByName.get(sample.name) ?? sample.name,
          state: sample.state,
        })),
        now,
      );
      drafts.forEach((draft) => {
        if (now < (suppressUntilRef.current.get(draft.name) ?? 0)) {
          return;
        }
        pushEvent(draft);
      });
      const prevStates = prevStateRef.current;
      prevStateRef.current = new Map(samples.map((sample) => [sample.name, sample.state]));

      const nextRows = current.map((entry) => {
        const sample = sampleByName.get(entry.name);
        const state = sample?.state ?? STATE_FALLBACK;
        const before = prevStates.get(entry.name);
        if (before && before !== 'Stopped' && state === 'Stopped') {
          lastStoppedRef.current.set(entry.name, now);
        }
        let metrics: ServiceRuntimeMetrics | null = null;
        if (sample && state === 'Running') {
          const prev = prevSampleRef.current.get(entry.name);
          const cpuPct = prev && now > prev.at
            ? ((sample.cpuTotal - prev.cpuTotal) / ((now - prev.at) / 1000)) * 100
            : null;
          metrics = { cpuPct, memBytes: sample.memBytes };
        }
        if (sample) {
          prevSampleRef.current.set(entry.name, { cpuTotal: sample.cpuTotal, at: now });
        }
        const info = staticInfoRef.current.get(entry.name);
        return {
          name: entry.name,
          displayName: entry.displayName || info?.displayName || entry.name,
          serviceType: entry.serviceType,
          state,
          autoStart: (info?.startType ?? '').startsWith('Automatic'),
          metrics,
          lastStoppedAt: lastStoppedRef.current.get(entry.name) ?? null,
        };
      });
      setRows(nextRows);
    } catch {
      // 采样失败（如非 Windows 构建）时保留上次数值。
    }
  }, [displayNameOf, pushEvent]);

  // 静态信息（启动类型/显示名）不随状态变化，仅在纳管列表变化时拉一次全量。
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await ListWindowsServices();
        if (cancelled || !result.success) {
          return;
        }
        const data = (result.data ?? {}) as { services?: Array<{ name: string; displayName: string; startType: string }> };
        const map = new Map<string, StaticServiceInfo>();
        (data.services ?? []).forEach((entry) => {
          map.set(entry.name, { displayName: entry.displayName || '', startType: entry.startType || '' });
        });
        staticInfoRef.current = map;
        void pollOnce();
      } catch {
        // SCM 不可达时沿用现有静态信息。
      }
    })();
    return () => {
      cancelled = true;
    };
    // pollOnce 是稳定的 useCallback。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  useEffect(() => {
    void pollOnce();
    const timer = window.setInterval(() => {
      void pollOnce();
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // pollOnce 是稳定的 useCallback。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  const controlService = useCallback(
    async (name: string, action: ServiceControlAction) => {
      setPendingOps((prev) => ({ ...prev, [name]: action }));
      try {
        const result = await ControlWindowsService(name, action);
        const entry = servicesRef.current.find((item) => item.name === name);
        const displayName = displayNameOf(entry ?? ({ name } as ManagedServiceEntry));
        if (!result.success) {
          const detail = result.message ?? '';
          pushEvent({
            at: Date.now(),
            level: 'err',
            name,
            service: displayName,
            key: action === 'start' ? 'home.events.startFailed' : 'home.events.stopFailed',
            params: { detail },
          });
          message.error(detail || t('home.backend.error.control_failed', { detail: '' }));
          return;
        }
        suppressUntilRef.current.set(name, Date.now() + MANUAL_EVENT_SUPPRESS_MS);
        pushEvent({
          at: Date.now(),
          level: 'run',
          name,
          service: displayName,
          key: action === 'stop' ? 'home.events.stopped' : action === 'start' ? 'home.events.started' : 'home.events.restart',
        });
      } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
      } finally {
        setPendingOps((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        void pollOnce();
      }
    },
    [displayNameOf, pollOnce, pushEvent, t],
  );

  const counts = useMemo<ServiceRuntimeCounts>(() => {
    const running = rows.filter((row) => row.state === 'Running').length;
    const stopped = rows.filter((row) => row.state === 'Stopped').length;
    return {
      all: rows.length,
      running,
      stopped,
      error: rows.length - running - stopped,
      auto: rows.filter((row) => row.autoStart).length,
    };
  }, [rows]);

  return { rows, counts, pendingOps, controlService, refreshNow: () => void pollOnce() };
}
