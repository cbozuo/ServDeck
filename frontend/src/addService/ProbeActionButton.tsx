import React, { useEffect, useRef, useState } from 'react';
import {
  CheckOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useI18n } from '../i18n/provider';
import './probeActionButton.css';

/**
 * 添加服务弹窗的「探测」按钮：单动作按钮，无下拉、无箭头。
 *
 * - 悬浮提示由外层 Tooltip 承接（service.modal.probe.actionTip）：本组件必须把 Tooltip
 *   注入的鼠标/焦点事件继续透传到原生 button（并转发 ref），否则提示不会触发；
 * - 探测逻辑仍在弹窗的 runProbe 中，本组件只负责四态图标与短时成功闪现；
 * - 本地探测可能几十毫秒就返回，动画一闪而过，因此探测中状态至少展示 MIN_BUSY_MS；
 * - 颜色一律走 --gn-* token，浅/深/自定义主题自动跟随。
 */

export interface ProbeActionButtonProps {
  /** 正在探测（由弹窗的 probing 状态驱动）。 */
  probing: boolean;
  /** 探测结果相位：none（未探测）/ probing / ok / exists / error。 */
  phase: string;
  /**
   * 探测失败：弹窗侧按同一口径计算（phase === 'error'，或 ok 但程序文件缺失）。
   * 只传 phase 会漏掉「文件不存在」这类最常见的失败——它由 ok + fileExists=false 表达。
   */
  failed?: boolean;
  onProbe: () => void;
}

type ProbeButtonHtmlProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'disabled' | 'className'
>;

/** 成功闪现时长：与高保真一致的 400ms，之后回落到常态。 */
const FLASH_MS = 400;
/** 探测中状态的最小展示时长：保证动画可见（本地探测可能瞬间返回）。 */
const MIN_BUSY_MS = 1000;

/** 探测成功相位（可继续「加入纳管」）：用于决定闪现。 */
const SUCCESS_PHASES = new Set(['ok', 'exists']);

export const ProbeActionButton = React.forwardRef<
  HTMLButtonElement,
  ProbeActionButtonProps & ProbeButtonHtmlProps
>(({ probing, phase, failed = false, onProbe, ...rest }, ref) => {
  const { t } = useI18n();
  const [flashOk, setFlashOk] = useState(false);
  const [minBusy, setMinBusy] = useState(false);
  const wasBusy = useRef(false);

  // 探测中最小展示时长：真实探测更快时，视觉上仍保持 busy 到 MIN_BUSY_MS。
  useEffect(() => {
    if (!probing) {
      return undefined;
    }
    setMinBusy(true);
    const timer = window.setTimeout(() => setMinBusy(false), MIN_BUSY_MS);
    return () => window.clearTimeout(timer);
  }, [probing]);

  const busy = probing || minBusy;

  // busy 下降沿 + 成功相位 → 成功闪现。
  // 只切图标与底色，文案沿用现有三态，不引入新的 i18n 键。
  useEffect(() => {
    const justFinished = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!justFinished || failed || !SUCCESS_PHASES.has(phase)) {
      return undefined;
    }
    setFlashOk(true);
    const timer = window.setTimeout(() => setFlashOk(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [busy, phase]);

  const label = busy
    ? t('service.modal.probe.probing')
    : phase === 'none'
      ? t('service.modal.probe.action')
      : t('service.modal.probe.again');

  const className = ['asm-probe-btn'];
  if (busy) className.push('is-busy');
  else if (failed || phase === 'error') className.push('is-fail');
  else if (flashOk) className.push('is-ok', 'flash-ok');

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className={className.join(' ')}
      disabled={busy}
      onClick={onProbe}
    >
      <span className="asm-probe-slot">
        <SearchOutlined className="asm-probe-ic asm-probe-ic-search" />
        <LoadingOutlined className="asm-probe-ic asm-probe-ic-spin" />
        <CheckOutlined className="asm-probe-ic asm-probe-ic-ok" />
        <ExclamationCircleFilled className="asm-probe-ic asm-probe-ic-fail" />
      </span>
      <span className="asm-probe-label">{label}</span>
    </button>
  );
});

ProbeActionButton.displayName = 'ProbeActionButton';
