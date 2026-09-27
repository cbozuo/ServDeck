import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import {
  CheckCircleFilled,
  LoadingOutlined,
  MoreOutlined,
  CaretRightFilled,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useI18n } from '../../i18n/provider';
import { ListWindowsServices, SampleHostResources } from '../../../wailsjs/go/app/App';
import { useServiceRegistryStore } from '../../serviceRegistryStore';
import type { ManagedServiceEntry } from '../../serviceRegistryStore';
import './ServiceHome.css';

export interface ServiceHomeProps {
  onAddService?: () => void;
}

type FilterKey = 'all' | 'running' | 'stopped' | 'error' | 'auto';

interface ServiceRow {
  name: string;
  displayName: string;
  serviceType: string;
  state: string;
  startType: string;
  managed: boolean;
}

interface ResourceSample {
  cpu: { idle: number; kernel: number; user: number };
  memory: { total: number; avail: number; memoryLoad: number };
  disks: Array<{ drive: string; total: number; free: number; used: number; usedPct: number }>;
}

const POLL_MS = 2000;
const STATE_FALLBACK = 'Unknown';

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

/** 服务总览首页：本机资源四卡 + 纳管服务列表（实时状态）+ 右栏（事件/引擎）。 */
export const ServiceHome: React.FC<ServiceHomeProps> = ({ onAddService }) => {
  const { t } = useI18n();
  const services = useServiceRegistryStore((state) => state.services);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [scmState, setScmState] = useState<Map<string, { state: string; startType: string; displayName: string }>>(new Map());
  const [resource, setResource] = useState({ cpuPct: 0, memPct: 0, memUsed: 0, memTotal: 0, disk: null as null | { usedPct: number; used: number; total: number } });
  const [scanning, setScanning] = useState(false);

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
    } catch {
      // 采样失败（如非 Windows 构建）时保留上次数值。
    }
  }, []);

  const refreshServices = useCallback(async () => {
    try {
      const result = await ListWindowsServices();
      if (!result.success) {
        return;
      }
      const data = (result.data ?? {}) as { services?: Array<{ name: string; displayName: string; state: string; startType: string }> };
      const map = new Map<string, { state: string; startType: string; displayName: string }>();
      (data.services ?? []).forEach((entry) => {
        map.set(entry.name, { state: entry.state || STATE_FALLBACK, startType: entry.startType || '', displayName: entry.displayName || '' });
      });
      setScmState(map);
    } catch {
      // SCM 不可达时保留上次状态。
    }
  }, []);

  const refreshAll = useCallback(() => {
    setScanning(true);
    void refreshResources();
    void refreshServices().finally(() => setScanning(false));
  }, [refreshResources, refreshServices]);

  useEffect(() => {
    void refreshAll();
    const timer = window.setInterval(() => {
      void refreshResources();
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // refreshAll 仅依赖稳定的 useCallback。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: ServiceRow[] = useMemo(
    () =>
      services.map((entry: ManagedServiceEntry) => {
        const scm = scmState.get(entry.name);
        return {
          name: entry.name,
          displayName: entry.displayName || scm?.displayName || entry.name,
          serviceType: entry.serviceType,
          state: scm?.state ?? STATE_FALLBACK,
          startType: scm?.startType || '',
          managed: true,
        };
      }),
    [services, scmState],
  );

  const isRunning = (state: string): boolean => state === 'Running';
  const counts = useMemo(() => {
    const running = rows.filter((row) => isRunning(row.state)).length;
    const stopped = rows.filter((row) => row.state === 'Stopped').length;
    const error = rows.length - running - stopped;
    const auto = rows.filter((row) => row.startType.startsWith('Automatic')).length;
    return { all: rows.length, running, stopped, error, auto };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'running' && !isRunning(row.state)) return false;
      if (filter === 'stopped' && row.state !== 'Stopped') return false;
      if (filter === 'error' && row.state !== 'StartPending' && row.state !== 'StopPending' && row.state !== 'Unknown' && row.state !== '') return false;
      if (filter === 'auto' && !row.startType.startsWith('Automatic')) return false;
      if (kw && !row.name.toLowerCase().includes(kw) && !row.displayName.toLowerCase().includes(kw)) {
        return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const typeIconSrc = (serviceType: string): string => `/db-icons/${serviceType}.svg`;

  return (
    <div className="svc-home">
      <div className="svc-home-head">
        <div>
          <h1>{t('home.title')}</h1>
          <div className="sub">
            {t('home.summary', { total: rows.length, running: counts.running })}
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
          <button className="h-btn h-btn-ghost" onClick={() => void refreshAll()}>
            <ReloadOutlined style={{ fontSize: 13 }} />
            {t('home.action.refresh')}
          </button>
          <button className="h-btn h-btn-primary" onClick={() => onAddService?.()}>
            <PlusOutlined style={{ fontSize: 13 }} />
            {t('home.action.register')}
          </button>
        </div>
      </div>

      {/* 本机资源四卡 */}
      <div className="res-row">
        <div className="res-card">
          <div className="rc-top">
            <span className="rc-ico ico-cpu"><CpuIcon /></span>
            <span className="rc-label">{t('home.res.cpu')}</span>
          </div>
          <div className="rc-val">{resource.cpuPct}<small>%</small></div>
          <div className="rc-sub">{t('home.res.cpuSub')}</div>
          <div className="rc-viz"><CpuSpark percent={resource.cpuPct} /></div>
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
        <button className={filter === 'all' ? 'chip on' : 'chip'} onClick={() => setFilter('all')}>
          {t('home.filter.all')} <span className="n">{counts.all}</span>
        </button>
        <button className={filter === 'running' ? 'chip on' : 'chip'} onClick={() => setFilter('running')}>
          {t('home.filter.running')} <span className="n">{counts.running}</span>
        </button>
        <button className={filter === 'stopped' ? 'chip on' : 'chip'} onClick={() => setFilter('stopped')}>
          {t('home.filter.stopped')} <span className="n">{counts.stopped}</span>
        </button>
        <button className={filter === 'error' ? 'chip on' : 'chip'} onClick={() => setFilter('error')}>
          {t('home.filter.error')} <span className="n">{counts.error}</span>
        </button>
      </div>

      {/* 主区两栏 */}
      <div className="main-cols">
        <div className="svc-list">
          {visibleRows.length === 0 ? (
            <div className="svc-empty">
              <p>{t('home.list.empty')}</p>
              <button className="h-btn h-btn-primary" onClick={onAddService}>
                <PlusOutlined style={{ fontSize: 13 }} />
                {t('home.action.register')}
              </button>
            </div>
          ) : (
            visibleRows.map((row) => (
              <div key={row.name} className="svc-row">
                <span className="svc-ico">
                  <img src={typeIconSrc(row.serviceType)} alt="" />
                </span>
                <span className="svc-id">
                  <span className="svc-name">{row.displayName}</span>
                  <span className="svc-real">{row.name} · {row.serviceType}</span>
                </span>
                <span className="svc-state-cell">
                  <span className={`svc-badge ${row.state === 'Running' ? 'run' : row.state === 'Stopped' ? 'stop' : 'stop'}`}>
                    <i />
                    {t(`home.state.${row.state}`)}
                  </span>
                </span>
                <span className="svc-starttype">{row.startType}</span>
                <span className="svc-ops">
                  <button className="op-btn stopb" title={t('home.ops.stop')}><StopOutlined style={{ fontSize: 13 }} /></button>
                  <button className="op-btn play" title={t('home.ops.start')}><CaretRightFilled style={{ fontSize: 13 }} /></button>
                  <button className="op-btn" title={t('home.ops.more')}><MoreOutlined style={{ fontSize: 13 }} /></button>
                </span>
              </div>
            ))
          )}
        </div>

        <div className="side-col">
          <div className="side-card">
            <h4>{t('home.side.engine')}</h4>
            <div className="engine-card">
              <i className="engine-dot" />
              <span className="ec-text">servy-10.1.exe</span>
              <span className="ec-ver">v10.1</span>
            </div>
          </div>
        </div>
      </div>
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

/** CPU 迷你趋势线（占位形状，实际数据接入后由历史采样点渲染）。 */
const CpuSpark: React.FC<{ percent: number }> = ({ percent }) => {
  const y = 30 - (percent / 100) * 26;
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none">
      <path d={`M0,${y} 100,${y} L100,34 0,34 Z`} fill="var(--gn-accent)" opacity="0.1" />
      <line x1="0" y1={y} x2="100" y2={y} stroke="var(--gn-accent)" strokeWidth="1.6" />
    </svg>
  );
};

