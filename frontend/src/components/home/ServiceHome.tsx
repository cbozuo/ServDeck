import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CaretRightFilled,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useI18n } from '../../i18n/provider';
import type { I18nParams } from '../../i18n/types';
import { LocateServyEngine, SampleHostResources } from '../../../wailsjs/go/app/App';
import { useServiceRegistryStore } from '../../serviceRegistryStore';
import { useServiceRuntime, type ServiceControlAction, type ServiceRuntimeRow } from './useServiceRuntime';
import { HomeEventsCard } from './HomeEventsCard';
import './ServiceHome.css';

export interface ServiceHomeProps {
  onAddService?: () => void;
}

type FilterKey = 'all' | 'running' | 'stopped' | 'error' | 'auto';

interface ResourceSample {
  cpu: { idle: number; kernel: number; user: number };
  memory: { total: number; avail: number; memoryLoad: number };
  disks: Array<{ drive: string; total: number; free: number; used: number; usedPct: number }>;
}

const POLL_MS = 2000;
/** CPU 趋势线保留的采样点数（2s 一次，约 40 秒窗口）。 */
const CPU_HISTORY_LIMIT = 20;
/** 服务内存指标高亮阈值，超过按告警色显示。 */
const MEM_WARN_BYTES = 768 * 1024 * 1024;

/** 把后端资源快照转为前端展示模型；cpuPct 由两次快照差值计算。 */
function toResourceModel(
  sample: ResourceSample | null,
  prev: ResourceSample | null,
  prevPct: number,
): { cpuPct: number; memPct: number; memUsed: number; memTotal: number; disk: { usedPct: number; used: number; total: number } | null } {
  if (!sample) {
    return { cpuPct: prevPct, memPct: 0, memUsed: 0, memTotal: 0, disk: null };
  }
  let cpuPct = prevPct;
  if (prev && sample.cpu && prev.cpu) {
    const dIdle = sample.cpu.idle - prev.cpu.idle;
    const dKernel = sample.cpu.kernel - prev.cpu.kernel;
    const dUser = sample.cpu.user - prev.cpu.user;
    const dTotal = dKernel + dUser;
    if (dTotal > 0) {
      cpuPct = Math.min(100, Math.max(0, Math.round(((dTotal - dIdle) / dTotal) * 100)));
    }
  }
  const memPct = sample.memory?.memoryLoad ?? 0;
  const memTotal = (sample.memory?.total ?? 0) / (1024 * 1024 * 1024);
  const memUsed = memTotal - (sample.memory?.avail ?? 0) / (1024 * 1024 * 1024);
  const disk = sample.disks?.[0] ?? null;
  return { cpuPct, memPct, memUsed, memTotal, disk };
}

const fmtGB = (bytes: number): string => `${bytes.toFixed(1)} GB`;

const fmtMemBytes = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)}GB` : `${Math.round(bytes / 1024 ** 2)}MB`;

/** 会话内相对时间：上次停止的展示值。 */
function fmtRelativeTime(at: number, t: (key: string, params?: I18nParams) => string): string {
  const minutes = Math.floor((Date.now() - at) / 60000);
  if (minutes < 1) return t('home.metrics.justNow');
  if (minutes < 60) return t('home.metrics.minutesAgo', { n: minutes });
  return t('home.metrics.hoursAgo', { n: Math.floor(minutes / 60) });
}

function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 11) return 'home.greeting.morning';
  if (hour >= 11 && hour < 18) return 'home.greeting.afternoon';
  if (hour >= 18 && hour < 23) return 'home.greeting.evening';
  return 'home.greeting.night';
}

/** 服务总览首页：本机资源四卡 + 纳管服务列表（实时状态/指标/启停）+ 右栏（事件/引擎）。 */
export const ServiceHome: React.FC<ServiceHomeProps> = ({ onAddService }) => {
  const { t } = useI18n();
  const services = useServiceRegistryStore((state) => state.services);
  const runtime = useServiceRuntime(services);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [resource, setResource] = useState({ cpuPct: 0, memPct: 0, memUsed: 0, memTotal: 0, disk: null as null | { usedPct: number; used: number; total: number } });
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [engine, setEngine] = useState<{ available: boolean; path?: string; reason?: string } | null>(null);

  const prevSampleRef = useRef<ResourceSample | null>(null);
  const prevPctRef = useRef(0);

  const refreshResources = useCallback(async () => {
    try {
      const result = await SampleHostResources();
      if (!result.success) {
        return;
      }
      const sample = (result.data ?? null) as ResourceSample | null;
      if (!sample) {
        return;
      }
      const model = toResourceModel(sample, prevSampleRef.current, prevPctRef.current);
      prevSampleRef.current = sample;
      prevPctRef.current = model.cpuPct;
      setResource({ cpuPct: model.cpuPct, memPct: model.memPct, memUsed: model.memUsed, memTotal: model.memTotal, disk: model.disk });
      setCpuHistory((prev) => [...prev.slice(-(CPU_HISTORY_LIMIT - 1)), model.cpuPct]);
    } catch {
      // 采样失败（如非 Windows 构建）时保留上次数值。
    }
  }, []);

  useEffect(() => {
    void refreshResources();
    void (async () => {
      try {
        const result = await LocateServyEngine();
        setEngine((result.data ?? null) as { available: boolean; path?: string; reason?: string } | null);
      } catch {
        setEngine({ available: false });
      }
    })();
    const timer = window.setInterval(() => {
      void refreshResources();
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // refreshResources 仅依赖稳定的 useCallback。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return runtime.rows.filter((row) => {
      if (filter === 'running' && row.state !== 'Running') return false;
      if (filter === 'stopped' && row.state !== 'Stopped') return false;
      if (filter === 'error' && row.state !== 'StartPending' && row.state !== 'StopPending' && row.state !== 'Unknown' && row.state !== '') return false;
      if (filter === 'auto' && !row.autoStart) return false;
      if (kw && !row.name.toLowerCase().includes(kw) && !row.displayName.toLowerCase().includes(kw)) {
        return false;
      }
      return true;
    });
  }, [runtime.rows, filter, search]);

  const refreshAll = useCallback(() => {
    void refreshResources();
    runtime.refreshNow();
  }, [refreshResources, runtime]);
  const chips: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all', label: t('home.filter.all'), count: runtime.counts.all },
    { key: 'running', label: t('home.filter.running'), count: runtime.counts.running },
    { key: 'stopped', label: t('home.filter.stopped'), count: runtime.counts.stopped },
    { key: 'error', label: t('home.filter.error'), count: runtime.counts.error },
    { key: 'auto', label: t('home.filter.auto'), count: runtime.counts.auto },
  ];

  const engineName = engine?.available && engine.path ? engine.path.split(/[\\/]/).pop() ?? '' : '';
  const engineVersion = engineName.match(/(\d+(?:\.\d+)*)/)?.[1] ?? '';

  return (
    <div className="svc-home">
      <div className="svc-home-head">
        <div>
          <h1>{t('home.title')}</h1>
          <div className="sub">
            {t(greetingKey(new Date().getHours()))}<b>{runtime.counts.all}</b>{t('home.summary.mid')}
            <b>{runtime.counts.running}</b>{t('home.summary.tail')}
            <span className="live-dot" />
            <span>{t('home.autoRefresh')}</span>
          </div>
        </div>
        <div className="home-tools">
          <div className="h-search">
            <SearchOutlined style={{ fontSize: 13 }} />
            <input
              value={search}
              placeholder={t('home.search.placeholder')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="h-btn h-btn-ghost" onClick={refreshAll}>
            <ReloadOutlined style={{ fontSize: 13 }} />
            {t('home.action.refresh')}
          </button>
          <button className="h-btn h-btn-primary" onClick={() => onAddService?.()}>
            <PlusOutlined style={{ fontSize: 13 }} />
            {t('home.action.register')}
          </button>
        </div>
      </div>

      {runtime.rows.length === 0 ? (
        <div className="empty-hero">
          <div className="eh-ico"><ServerGlyph /></div>
          <h3>{t('home.empty.title')}</h3>
          <p>{t('home.empty.desc')}</p>
          <div className="eh-actions">
            <button className="h-btn h-btn-primary" onClick={() => onAddService?.()}>
              <PlusOutlined style={{ fontSize: 13 }} />
              {t('home.action.register')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 本机资源四卡 */}
          <div className="res-row">
            <div className="res-card">
              <div className="rc-top">
                <span className="rc-ico ico-cpu"><CpuIcon /></span>
                <span className="rc-label">{t('home.res.cpu')}</span>
              </div>
              <div className="rc-val">{resource.cpuPct}<small>%</small></div>
              <div className="rc-sub">{t('home.res.cpuSub')}</div>
              <div className="rc-viz"><CpuSpark history={cpuHistory} /></div>
            </div>
            <div className="res-card">
              <div className="rc-top">
                <span className="rc-ico ico-mem"><MemIcon /></span>
                <span className="rc-label">{t('home.res.mem')}</span>
              </div>
              <div className="rc-val" style={resource.memPct >= 80 ? { color: 'var(--gn-danger)' } : resource.memPct >= 60 ? { color: 'var(--gn-warn)' } : undefined}>
                {resource.memPct}<small>%</small>
              </div>
              <div className="rc-sub">
                {resource.memTotal > 0
                  ? t('home.res.memSub', { used: fmtGB(resource.memUsed), total: fmtGB(resource.memTotal) })
                  : '—'}
              </div>
              <div className="rc-viz">
                <div className="rc-bar"><i style={{ width: `${resource.memPct}%`, background: resource.memPct >= 80 ? 'var(--gn-danger)' : resource.memPct >= 60 ? 'var(--gn-warn)' : 'var(--gn-info)' }} /></div>
              </div>
            </div>
            <div className="res-card">
              <div className="rc-top">
                <span className="rc-ico ico-disk"><DiskIcon /></span>
                <span className="rc-label">{t('home.res.disk')}</span>
              </div>
              <div className="rc-val">{resource.disk?.usedPct ?? '—'}<small>%</small></div>
              <div className="rc-sub">
                {resource.disk
                  ? t('home.res.diskSub', { used: fmtGB(resource.disk.used / 1024 ** 3), total: fmtGB(resource.disk.total / 1024 ** 3) })
                  : '—'}
              </div>
              <div className="rc-viz">
                <div className="rc-bar"><i style={{ width: `${resource.disk?.usedPct ?? 0}%`, background: 'var(--gn-info)' }} /></div>
              </div>
            </div>
            <div className="res-card res-card-soon">
              <div className="rc-top">
                <span className="rc-ico ico-net"><NetIcon /></span>
                <span className="rc-label">{t('home.res.net')}</span>
              </div>
              <div className="rc-val res-soon-val">—</div>
              <div className="rc-sub">{t('home.res.netSub')}</div>
            </div>
          </div>

          {/* 过滤胶囊 */}
          <div className="filter-chips">
            {chips.map((chip) => (
              <button
                key={chip.key}
                className={filter === chip.key ? 'chip on' : 'chip'}
                onClick={() => setFilter(chip.key)}
              >
                {chip.label} <span className="n">{chip.count}</span>
              </button>
            ))}
          </div>

          {/* 主区两栏 */}
          <div className="main-cols">
            <div className="svc-list">
              {visibleRows.map((row) => (
                <ServiceRowItem
                  key={row.name}
                  row={row}
                  pendingAction={runtime.pendingOps[row.name]}
                  onControl={(name, action) => void runtime.controlService(name, action)}
                />
              ))}
            </div>

            <div className="side-col">
              <HomeEventsCard />
              <div className="side-card">
                <h4>{t('home.side.engine')}</h4>
                <div className="engine-card" title={engine?.available ? engine.path : engine?.reason}>
                  <i className={engine?.available === false ? 'engine-dot missing' : 'engine-dot'} />
                  <span className="ec-text">
                    {engine === null ? '…' : engine.available ? `${engineName} · ${t('home.engine.ready')}` : t('home.engine.missing')}
                  </span>
                  <span className="ec-ver">{engine?.available ? engineVersion && `v${engineVersion}` : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/** 单个纳管服务行：图标/名称/状态徽章/指标列/悬停操作钮。 */
const ServiceRowItem: React.FC<{
  row: ServiceRuntimeRow;
  pendingAction: ServiceControlAction | undefined;
  onControl: (name: string, action: ServiceControlAction) => void;
}> = ({ row, pendingAction, onControl }) => {
  const { t } = useI18n();
  const isTerminal = row.state === 'Running' || row.state === 'Stopped';
  const badgeClass = row.state === 'Running' ? 'run' : row.state === 'Stopped' ? 'stop' : 'err';
  const busy = pendingAction !== undefined;

  return (
    <div className={isTerminal ? 'svc-row' : 'svc-row err'}>
      <span className="svc-ico">
        <img src={`/db-icons/${row.serviceType}.svg`} alt="" />
      </span>
      <span className="svc-id">
        <span className="svc-name">
          {row.displayName}
          {row.autoStart && <span className="auto">{t('home.badge.auto')}</span>}
        </span>
        <span className="svc-real">{row.name} · {row.serviceType}</span>
      </span>
      <span className="svc-state-cell">
        <span className={`svc-badge ${badgeClass}`}>
          <i />
          {t(`home.state.${row.state}`)}
        </span>
      </span>
      <span className="svc-metrics">
        {row.state === 'Running' ? (
          <>
            <span className="svc-m">
              <span className="m-k">{t('home.metrics.cpu')}</span>
              <span className="m-v">{row.metrics?.cpuPct == null ? '—' : `${row.metrics.cpuPct.toFixed(1)}%`}</span>
            </span>
            <span className="svc-m">
              <span className="m-k">{t('home.metrics.mem')}</span>
              <span className={row.metrics && row.metrics.memBytes >= MEM_WARN_BYTES ? 'm-v warn' : 'm-v'}>
                {row.metrics ? fmtMemBytes(row.metrics.memBytes) : '—'}
              </span>
            </span>
          </>
        ) : row.state === 'Stopped' ? (
          <span className="svc-m">
            <span className="m-k">{t('home.metrics.lastStopped')}</span>
            <span className="m-v">{row.lastStoppedAt ? fmtRelativeTime(row.lastStoppedAt, t) : '—'}</span>
          </span>
        ) : (
          <span className="svc-m">
            <span className="m-k">{t('home.metrics.cpu')}</span>
            <span className="m-v">—</span>
          </span>
        )}
      </span>
      <span className="svc-ops">
        {row.state === 'Running' ? (
          <>
            <button className="op-btn stopb" title={t('home.ops.stop')} disabled={busy} onClick={() => onControl(row.name, 'stop')}>
              {pendingAction === 'stop' ? <LoadingOutlined style={{ fontSize: 13 }} /> : <StopOutlined style={{ fontSize: 13 }} />}
            </button>
            <button className="op-btn" title={t('home.ops.restart')} disabled={busy} onClick={() => onControl(row.name, 'restart')}>
              {pendingAction === 'restart' ? <LoadingOutlined style={{ fontSize: 13 }} /> : <SyncOutlined style={{ fontSize: 13 }} />}
            </button>
          </>
        ) : (
          <button className="op-btn play" title={t('home.ops.start')} disabled={busy} onClick={() => onControl(row.name, 'start')}>
            {pendingAction === 'start' ? <LoadingOutlined style={{ fontSize: 13 }} /> : <CaretRightFilled style={{ fontSize: 13 }} />}
          </button>
        )}
        <button className="op-btn" title={t('home.ops.more')}>
          <MoreOutlined style={{ fontSize: 13 }} />
        </button>
      </span>
    </div>
  );
};

/* 内联小图标（资源卡专用，避免额外依赖） */
const CpuIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="13" height="13"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M6.5 1.5v2M9.5 1.5v2M6.5 12.5v2M9.5 12.5v2M1.5 6.5h2M1.5 9.5h2M12.5 6.5h2M12.5 9.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
);
const MemIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="13" height="13"><rect x="1.5" y="4" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M4.5 7v2M7 7v2M9.5 7v2M12 7v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
);
const DiskIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="13" height="13"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M12.2 3.8L9.4 6.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
);
const NetIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="13" height="13"><path d="M2 9.5C4 6 6 4.5 8 4.5s4 1.5 6 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/><path d="M8 11.5v3M5.5 13l2.5 1.5L10.5 13" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const ServerGlyph: React.FC = () => (
  <svg viewBox="0 0 16 16" width="26" height="26"><rect x="2" y="2.5" width="12" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="2" y="9" width="12" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" fill="none"/><circle cx="4.8" cy="4.75" r="0.9" fill="currentColor"/><circle cx="4.8" cy="11.25" r="0.9" fill="currentColor"/></svg>
);

/** CPU 迷你趋势线：由最近采样点渲染历史折线，不足两点时退化为单点平线。 */
const CpuSpark: React.FC<{ history: number[] }> = ({ history }) => {
  const points = history.length > 0
    ? history.map((pct, index) => `${(index / Math.max(1, history.length - 1)) * 100},${30 - (Math.min(100, pct) / 100) * 26}`)
    : ['0,30', '100,30'];
  const line = points.join(' ');
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none">
      <path d={`M${line.split(' ').join(' L')} L100,34 L0,34 Z`} fill="var(--gn-accent)" opacity="0.1" />
      <polyline points={line} fill="none" stroke="var(--gn-accent)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
};
