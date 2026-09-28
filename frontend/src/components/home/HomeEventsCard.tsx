import React, { useState } from 'react';
import { Modal } from 'antd';
import { useI18n } from '../../i18n/provider';
import { useHomeEventsStore, type HomeEvent } from './homeEvents';

/** 卡片内最多展示最近 6 条，更多通过「全部 ›」弹窗查看。 */
const CARD_EVENT_LIMIT = 6;

const pad2 = (value: number): string => `${value}`.padStart(2, '0');

/** 当天只显示 HH:mm，跨天补日期，贴合设计稿的时间列宽度。 */
function formatEventTime(at: number): string {
  const date = new Date(at);
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return time;
  }
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${time}`;
}

const EventItem: React.FC<{ event: HomeEvent }> = ({ event }) => {
  const { t } = useI18n();
  return (
    <div className="event">
      <i className={`e-dot ${event.level}`} />
      <span className="e-time">{formatEventTime(event.at)}</span>
      <div className="e-body">
        <b>{event.service}</b>
        {t(event.key, event.params)}
      </div>
    </div>
  );
};

/** 右栏「最近事件」时间线卡：展示会话内的服务状态变化与操作结果。 */
export const HomeEventsCard: React.FC = () => {
  const { t } = useI18n();
  const events = useHomeEventsStore((state) => state.events);
  const [showAll, setShowAll] = useState(false);
  const visible = events.slice(0, CARD_EVENT_LIMIT);

  return (
    <div className="side-card">
      <h4>
        {t('home.events.title')}
        <span className="all-link" onClick={() => setShowAll(true)}>
          {t('home.events.all')}
        </span>
      </h4>
      <div className="events">
        {visible.length === 0 ? (
          <div className="events-empty">{t('home.events.empty')}</div>
        ) : (
          visible.map((event) => <EventItem key={event.id} event={event} />)
        )}
      </div>
      <Modal
        open={showAll}
        title={t('home.events.title')}
        footer={null}
        width={460}
        onCancel={() => setShowAll(false)}
      >
        <div className="events events-in-modal">
          {events.length === 0 ? (
            <div className="events-empty">{t('home.events.empty')}</div>
          ) : (
            events.map((event) => <EventItem key={event.id} event={event} />)
          )}
        </div>
      </Modal>
    </div>
  );
};
