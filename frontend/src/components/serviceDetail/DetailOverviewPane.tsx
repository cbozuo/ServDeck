import React, { useMemo } from 'react';
import { useI18n } from '../../i18n/provider';
import { buildTrendBands, type DetailTrendPoint } from './detailTrend';
import type { ServiceDetailInfo, ServiceDetailSample, ServicePortCheck } from './useServiceDetail';

const fmtRate = (bps: number): string => {
  if (!Number.isFinite(bps) || bps <= 0) return '0 B/s';
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`;
  if (bps < 1024 ** 3) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  return `${(bps / 1024 ** 3).toFixed(2)} GB/s`;
};

const fmtGB = (bytes: number): string => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

const Spark: React.FC<{ values: number[]; max?: number; color?: string }> = ({ values, max, color = 'var(--gn-accent)' }) => {
  if (values.length < 2) {
    return <svg className="dtl-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" />;
  }
  const top = Math.max(max ?? 0, ...values, 0.0001);
  const line = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${22 - (Math.min(v, top) / top) * 20}`)
    .join(' ');
  return (
    <svg className="dtl-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M${line.split(' ').join(' L')} L100,24 L0,24 Z`} fill={color} opacity="0.1" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
};

export interface DetailOverviewPaneProps {
  info: ServiceDetailInfo | null;
  sample: ServiceDetailSample | null;
  ports: ServicePortCheck[];
  dirBytes: number;
  dirLabel: string;
  trend: DetailTrendPoint[];
  memMaxMB?: number;
  running: boolean;
  onOpenEvents: () => void;
}

/** 概览页签：8 张资源卡 + 30 分钟分带趋势（未运行时前 6 卡 ghost 态）。 */
export const DetailOverviewPane: React.FC<DetailOverviewPaneProps> = ({
  info,
  sample,
  ports,
  dirBytes,
  dirLabel,
  trend,
  memMaxMB,
  running,
  onOpenEvents,
}) => {
  const { t } = useI18n();
  const cpuValues = trend.map((p) => p.cpuPct);
  const cpuPeak = cpuValues.length > 0 ? Math.max(...cpuValues) : 0;
  const cpuAvg = cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0;
  const memPct = memMaxMB && memMaxMB > 0 && sample ? Math.round((sample.memBytes / 1024 ** 2 / memMaxMB) * 100) : 0;
  const bands = useMemo(() => buildTrendBands(trend), [trend]);
  const threadPeak = trend.length > 0 ? Math.max(...trend.map((p) => p.threads)) : 0;
  const ghost = !running || !sample;

  return (
    <div className="dtl-pane">
      <div className="dtl-sec-title">
        <span>{t('detail.overview.title')}</span>
        {running && <span className="dtl-live" />}
        <small>{t('detail.overview.subtitle')}</small>
      </div>

      <div className="dtl-res-grid">
        <div className={`dtl-res-card${ghost ? ' ghost' : ''}`}>
          <span className="dtl-rc-k">{t('detail.res.cpu')}</span>
          <span className="dtl-rc-val">{ghost ? '—' : `${(sample?.cpuPct ?? 0).toFixed(1)}`}<small>%</small></span>
          <Spark values={cpuValues} max={100} />
          <span className="dtl-rc-note">{t('detail.res.cpuNote', { avg: cpuAvg.toFixed(1), peak: cpuPeak.toFixed(1) })}</span>
        </div>
        <div className={`dtl-res-card${ghost ? ' ghost' : ''}`}>
          <span className="dtl-rc-k">{t('detail.res.mem')}</span>
          <span className="dtl-rc-val">{ghost ? '—' : Math.round((sample?.memBytes ?? 0) / 1024 ** 2)}<small>MB</small></span>
          <span className={`dtl-bar${memPct >= 80 ? ' warn' : ''}`}><i style={{ width: `${memPct}%` }} /></span>
          <span className="dtl-rc-note">
            {memMaxMB && memMaxMB > 0 ? t('detail.res.memNote', { max: memMaxMB, pct: memPct }) : t('detail.res.memNotePlain')}
            {memPct >= 80 ? ` · ${t('detail.res.memHigh')}` : ''}
          </span>
        </div>
        <div className={`dtl-res-card${ghost ? ' ghost' : ''}`}>
          <span className="dtl-rc-k">{t('detail.res.threads')}</span>
          <span className="dtl-rc-val">{ghost ? '—' : sample?.threads ?? '—'}</span>
          <Spark values={trend.map((p) => p.threads)} color="var(--gn-warn)" />
          <span className="dtl-rc-note">{t('detail.res.threadsNote', { peak: threadPeak })}</span>
        </div>
        <div className={`dtl-res-card${ghost ? ' ghost' : ''}`}>
          <span className="dtl-rc-k">{t('detail.res.handles')}</span>
          <span className="dtl-rc-val">{ghost ? '—' : sample?.handles ?? '—'}</span>
          <span className="dtl-rc-note">{t('detail.res.handlesNote')}</span>
        </div>
        <div className={`dtl-res-card${ghost ? ' ghost' : ''}`}>
          <span className="dtl-rc-k">{t('detail.res.disk')}</span>
          <span className="dtl-duo">
            <span>↓ {ghost ? '—' : fmtRate(sample?.diskReadBps ?? 0)}</span>
            <span>↑ {ghost ? '—' : fmtRate(sample?.diskWriteBps ?? 0)}</span>
          </span>
          <span className="dtl-rc-note">{t('detail.res.diskNote')}</span>
        </div>
        <div className={`dtl-res-card${ghost ? ' ghost' : ''}`}>
          <span className="dtl-rc-k">{t('detail.res.net')}</span>
          <span className="dtl-rc-val">{ghost ? '—' : sample?.netConns ?? '—'}</span>
          <span className="dtl-rc-note">{t('detail.res.netNote')}</span>
        </div>
        <div className="dtl-res-card">
          <span className="dtl-rc-k">{t('detail.res.dir', { label: dirLabel })}</span>
          <span className="dtl-rc-val">{dirBytes > 0 ? fmtGB(dirBytes) : '—'}</span>
          <span className="dtl-rc-note">{t('detail.res.dirNote')}</span>
        </div>
        <div className="dtl-res-card clickable" onClick={onOpenEvents} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpenEvents(); }}>
          <span className="dtl-rc-k">{t('detail.res.events')}</span>
          <span className="dtl-rc-evt">
            {ports.length > 0 && ports.some((p) => !p.listening)
              ? t('detail.res.eventsPortIssue', { n: ports.filter((p) => !p.listening).length })
              : t('detail.res.eventsEmpty')}
          </span>
          <span className="dtl-rc-note">{t('detail.res.eventsNote')}</span>
        </div>
      </div>

      <div className="dtl-panel">
        <div className="dtl-panel-head">
          <span>{t('detail.trend.title')}</span>
          <span className="dtl-legend">
            <i className="lg accent" />{t('detail.trend.cpu')}
            <i className="lg info" />{t('detail.trend.mem')}
            <i className="lg warn" />{t('detail.trend.threads')}
          </span>
        </div>
        {bands.length === 0 ? (
          <div className="dtl-chart-empty">{t('detail.trend.empty')}</div>
        ) : (
          <svg className="dtl-trend" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {bands.map((band, index) => (
              <React.Fragment key={index}>
                <polyline
                  points={band.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={['var(--gn-accent)', 'var(--gn-info)', 'var(--gn-warn)'][index]}
                  strokeWidth="0.006"
                  vectorEffect="non-scaling-stroke"
                />
              </React.Fragment>
            ))}
          </svg>
        )}
        <div className="dtl-trend-axis">
          <span>-30m</span><span>-20m</span><span>-10m</span><span>-5m</span><span>{t('detail.trend.now')}</span>
        </div>
        <span className="dtl-info-name">{info?.name ? `· ${info.name}` : ''}</span>
      </div>
    </div>
  );
};
