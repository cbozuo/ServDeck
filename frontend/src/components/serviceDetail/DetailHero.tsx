import React, { useState } from 'react';
import { Modal } from 'antd';
import {
  CaretRightFilled,
  CheckOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  PauseCircleFilled,
  PlayCircleFilled,
  PoweroffOutlined,
  QuestionCircleFilled,
  ReloadOutlined,
} from '@ant-design/icons';
import { useI18n } from '../../i18n/provider';
import { APP_NESTED_MODAL_Z_INDEX } from '../../utils/overlayZIndex';
import type { ServiceDetailInfo, ServiceDetailSample, ServicePortCheck } from './useServiceDetail';
import {
  detailAvailability,
  heroActions,
  isInstalled,
  pendingTextKey,
  type DetailAction,
  type DetailPending,
  type DetailRuleInput,
} from './detailRules';

// 图标走轻量语义系（实心三角/电源/旋转/对勾/删除），避免一排五个圆圈的重复感
const ACTION_ICONS: Partial<Record<DetailAction, React.ReactNode>> = {
  start: <CaretRightFilled />,
  stop: <PoweroffOutlined />,
  restart: <ReloadOutlined />,
  register: <CheckOutlined />,
  uninstall: <DeleteOutlined />,
};

export interface DetailHeroProps {
  info: ServiceDetailInfo | null;
  sample: ServiceDetailSample | null;
  ports: ServicePortCheck[];
  pending: DetailPending;
  ruleInput: DetailRuleInput;
  accentColor?: string;
  iconSrc: string;
  onControl: (action: 'start' | 'stop' | 'restart') => void;
  onRegister: () => void;
  onUninstall: () => void;
}

const formatUptime = (seconds: number, t: (key: string, params?: Record<string, string | number>) => string): string => {
  if (seconds <= 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(t('detail.uptime.d', { n: days }));
  if (days > 0 || hours > 0) parts.push(t('detail.uptime.h', { n: hours }));
  parts.push(t('detail.uptime.m', { n: minutes }));
  return parts.join(' ');
};

const formatClock = (epochSeconds: number): string => {
  if (epochSeconds <= 0) return '—';
  const date = new Date(epochSeconds * 1000);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/** 详情页 Hero：服务身份 + 三态 badge + 依赖端口告警 + 五命令（可用性矩阵驱动）。 */
export const DetailHero: React.FC<DetailHeroProps> = ({
  info,
  sample,
  ports,
  pending,
  ruleInput,
  accentColor,
  iconSrc,
  onControl,
  onRegister,
  onUninstall,
}) => {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState<'register' | 'uninstall' | null>(null);
  const state = ruleInput.processState;
  const installed = isInstalled(ruleInput);
  const hc = accentColor || 'var(--gn-accent)';
  const pendingKey = pendingTextKey(pending);

  const badge = !installed ? (
    <span className="dtl-badge unreg" title={t('detail.rule.notInstalled')}>
      <InfoCircleFilled />
      {t('detail.badge.unregistered')}
    </span>
  ) : state === 'Running' ? (
    <span className="dtl-badge run"><i />{t('home.state.Running')}</span>
  ) : state === 'Stopped' ? (
    <span className="dtl-badge stop"><i />{t('home.state.Stopped')}</span>
  ) : state === 'Unknown' ? (
    <span className="dtl-badge unknown"><QuestionCircleFilled />{t('home.state.Unknown')}</span>
  ) : (
    <span className="dtl-badge pend"><i />{t(pendingKey ?? 'detail.pending.starting')}</span>
  );

  const abnormalPorts = ports.filter((p) => !p.listening).length;
  const startAvail = detailAvailability('start', ruleInput);
  const stopAvail = detailAvailability('stop', ruleInput);
  const restartAvail = detailAvailability('restart', ruleInput);
  const registerAvail = detailAvailability('register', ruleInput);
  const uninstallAvail = detailAvailability('uninstall', ruleInput);

  const renderAction = (action: DetailAction) => {
    const avail =
      action === 'start' ? startAvail
        : action === 'stop' ? stopAvail
          : action === 'restart' ? restartAvail
            : action === 'register' ? registerAvail
              : uninstallAvail;
    const label = t(
      action === 'start' ? 'detail.action.start'
        : action === 'stop' ? 'detail.action.stop'
          : action === 'restart' ? 'detail.action.restart'
            : action === 'register'
              ? (ruleInput.mode === 'managed' && installed ? 'detail.action.reRegister' : 'detail.action.register')
              : 'detail.action.uninstall',
    );
    // 启动恒占主位（primary）：运行中禁用时由 CSS 降为软底淡字，主按钮位不消失；
    // 危险动作（卸载）用红描边与中性组同构，仅靠色相区分
    const className =
      action === 'start' ? 'dtl-btn primary'
        : action === 'uninstall' ? 'dtl-btn danger-o'
          : 'dtl-btn';
    const disabled = !avail.allowed;
    const title = disabled && avail.reasonKey ? t(avail.reasonKey) : label;
    const busy = pending === (action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : action === 'restart' ? 'restarting' : action === 'register' ? 'installing' : 'uninstalling');
    const handleClick = () => {
      if (action === 'start' || action === 'stop' || action === 'restart') {
        onControl(action);
      } else if (action === 'register') {
        setConfirm('register');
      } else {
        setConfirm('uninstall');
      }
    };
    return (
      <button
        key={action}
        type="button"
        className={`${className}${busy ? ' busy' : ''}`}
        disabled={disabled}
        title={title}
        onClick={handleClick}
      >
        {busy ? <ReloadOutlined spin /> : ACTION_ICONS[action]}
        {label}
      </button>
    );
  };

  const confirmMeta = confirm === 'register'
    ? { icon: <InfoCircleFilled className="dtl-confirm-ico info" />, okText: t(ruleInput.mode === 'managed' ? 'detail.action.reRegister' : 'detail.action.register'), danger: false }
    : { icon: <ExclamationCircleFilled className="dtl-confirm-ico danger" />, okText: t('detail.action.uninstall'), danger: true };

  return (
    <section className="dtl-hero" style={{ borderLeftColor: hc }}>
      <span className="dtl-hero-ico" style={{ background: `color-mix(in srgb, ${hc} 14%, var(--gn-bg-panel))`, borderColor: `color-mix(in srgb, ${hc} 30%, transparent)` }}>
        <img src={iconSrc} alt="" />
      </span>
      <div className="dtl-hero-main">
        <div className="dtl-hero-title">
          <h1>{info?.displayName || info?.name || '—'}</h1>
          {badge}
          {abnormalPorts > 0 && (
            <span className="dtl-port-pill" title={t('detail.ports.pillTip')}>
              <ExclamationCircleFilled />
              {t('detail.ports.abnormal', { n: abnormalPorts })}
            </span>
          )}
        </div>
        {info?.description ? <p className="dtl-hero-desc">{info.description}</p> : null}
        <div className="dtl-hero-meta">
          {state === 'Running' && sample?.pid ? (
            <>
              <span>PID <b>{sample.pid}</b></span>
              <i>·</i>
              <span>{t('detail.meta.uptime', { duration: formatUptime(info?.uptimeSeconds ?? 0, t) })}</span>
              <i>·</i>
              <span>{t('detail.meta.startedAt', { time: formatClock(info?.startedAt ?? 0) })}</span>
            </>
          ) : (
            <span>{t('detail.meta.notRunning')}</span>
          )}
        </div>
      </div>
      <div className="dtl-hero-acts">
        {heroActions(ruleInput.mode).map(renderAction)}
      </div>

      <Modal
        open={confirm !== null}
        onCancel={() => setConfirm(null)}
        footer={null}
        width={400}
        centered
        zIndex={APP_NESTED_MODAL_Z_INDEX + 60}
        wrapClassName="dtl-confirm-wrap"
        styles={{ header: { display: 'none' }, body: { padding: 0 } }}
      >
        <div className="dtl-confirm">
          <div className="dtl-confirm-head">
            {confirmMeta.icon}
            <h3>{t(confirm === 'register' ? 'detail.confirm.registerTitle' : 'detail.confirm.uninstallTitle')}</h3>
          </div>
          <p>
            {confirm === 'register'
              ? t(ruleInput.mode === 'managed' ? 'detail.confirm.registerBody' : 'detail.confirm.adoptBody')
              : ruleInput.mode === 'adopted'
                ? t('detail.confirm.adoptedUninstallBody')
                : t('detail.confirm.uninstallBody')}
          </p>
          <div className="dtl-confirm-acts">
            <button type="button" className="dtl-btn" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={`dtl-btn ${confirmMeta.danger ? 'danger-o' : 'primary'}`}
              onClick={() => {
                if (confirm === 'register') {
                  onRegister();
                } else if (confirm === 'uninstall') {
                  onUninstall();
                }
                setConfirm(null);
              }}
            >
              {confirmMeta.okText}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export const DetailPendingIcon: React.FC<{ pending: DetailPending }> = ({ pending }) =>
  pending === 'starting' || pending === 'restarting' ? <PlayCircleFilled /> : <PauseCircleFilled />;
