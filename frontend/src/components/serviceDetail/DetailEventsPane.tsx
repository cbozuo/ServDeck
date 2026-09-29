import React from 'react';
import { useI18n } from '../../i18n/provider';
import { useHomeEventsStore } from '../home/homeEvents';
import { useServiceEngineEvents } from './useServiceDetail';

/** 事件页签：servy 引擎事件（引擎写盘的真实时刻，持久）+ 本会话操作事件（按服务过滤）。 */
export const DetailEventsPane: React.FC<{ name: string; displayName: string }> = ({ name, displayName }) => {
  const { t } = useI18n();
  const events = useHomeEventsStore((state) => state.events);
  const engineEvents = useServiceEngineEvents(name, true);
  const mine = events.filter((event) => event.name === name || event.service === displayName || event.service === name);

  const formatTime = (at: number): string => {
    const d = new Date(at);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const engineLevelClass = (level: string): string => {
    const upper = level.toUpperCase();
    if (upper.includes('ERROR') || upper.includes('FATAL')) return 'err';
    if (upper.includes('WARN')) return 'warn';
    return 'info';
  };

  return (
    <div className="dtl-pane">
      <div className="dtl-panel">
        <div className="dtl-panel-head">
          <span>{t('detail.events.title')}</span>
        </div>
        {/* 自适应滚动视图：与日志框同款尺寸策略（少内容贴内容、多内容框内滚动） */}
        <div className="dtl-log-view dtl-events-view">
          {engineEvents.length > 0 && (
            <>
              <div className="dtl-events-sub">{t('detail.events.engine')}</div>
              <div className="dtl-events">
                {engineEvents.map((event, index) => (
                  <div key={`engine-${index}`} className="dtl-event">
                    <i className={`dtl-e-dot ${engineLevelClass(event.level)}`} />
                    <span className="dtl-e-time mono">{formatTime(event.at * 1000)}</span>
                    <div className="dtl-e-body">
                      <b>servy</b>
                      {' '}
                      {event.text}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="dtl-events-sub">{t('detail.events.session')}</div>
          <div className="dtl-events">
            {mine.length === 0 ? (
              <div className="dtl-events-empty">{t('detail.events.empty')}</div>
            ) : (
              mine.map((event) => (
                <div key={event.id} className="dtl-event">
                  <i className={`dtl-e-dot ${event.level}`} />
                  <span className="dtl-e-time mono">{formatTime(event.at)}</span>
                  <div className="dtl-e-body">
                    <b>{event.service}</b>
                    {t(event.key, event.params)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
