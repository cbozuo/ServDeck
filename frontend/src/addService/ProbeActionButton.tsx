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
 * - 悬浮提示由外层 Tooltip 承接（service.modal.probe.actionTip），本组件只管按钮本体；
 * - 探测逻辑仍在弹窗的 runProbe 中，本组件仅负责四态图标与短时成功闪现；
 * - 颜色一律走 --gn-* token，浅/深/自定义主题自动跟随。
 */

export interface ProbeActionButtonProps {
  /** 正在探测（由弹窗的 probing 状态驱动）。 */
  probing: boolean;
  /** 探测结果相位：none（未探测）/ probing / ok / exists / error。 */
  phase: string;
  onProbe: () => void;
}

/** 成功闪现时长：与高保真一致的 400ms，之后回落到常态。 */
const FLASH_MS = 400;

/** 探测成功相位（可继续「加入纳管」）：用于决定闪现。 */
const SUCCESS_PHASES = new Set(['ok', 'exists']);

export const ProbeActionButton: React.FC<ProbeActionButtonProps> = ({
  probing,
  phase,
  onProbe,
}) => {
  const { t } = useI18n();
  const [flashOk, setFlashOk] = useState(false);
  const wasProbing = useRef(false);

  // 探测刚结束（probing true→false）且结果为可用相位 → 成功闪现。
  // 只切图标与底色，文案沿用现有三态，不引入新的 i18n 键。
  useEffect(() => {
    const justFinished = wasProbing.current && !probing;
    wasProbing.current = probing;
    if (!justFinished || !SUCCESS_PHASES.has(phase)) {
      return undefined;
    }
    setFlashOk(true);
    const timer = window.setTimeout(() => setFlashOk(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [probing, phase]);

  const label = probing
    ? t('service.modal.probe.probing')
    : phase === 'none'
      ? t('service.modal.probe.action')
      : t('service.modal.probe.again');

  const className = ['asm-probe-btn'];
  if (probing) className.push('is-busy');
  else if (phase === 'error') className.push('is-fail');
  else if (flashOk) className.push('is-ok', 'flash-ok');

  return (
    <button
      type="button"
      className={className.join(' ')}
      disabled={probing}
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
};
