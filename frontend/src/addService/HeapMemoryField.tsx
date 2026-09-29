import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip, message } from 'antd';
import { SampleHostResources } from '../../wailsjs/go/app/App';
import { useI18n } from '../i18n/provider';
import {
  HEAP_FALLBACK_TOTAL_GB,
  canonicalHeap,
  heapCapFromTotalBytes,
  heapDisplayValue,
  heapGBFromArgs,
  heapLabel,
  heapStopsForCap,
  nearestStopIndex,
  parseHeapInput,
} from './heapMemory';

/**
 * 堆内存字段：定宽滑杆 + 可键入数值框 + 本机上限提示（对齐服务详情页高保真）。
 *
 * 直接读写 JVM 参数串（jvmArgs）：提交时 -Xms/-Xmx 同值写在参数最前、其余参数
 * 保留原位，输入框里的变化立即可见——与详情页「常用参数」同一交互。
 * 拖动吸附档位，松手写入；数值框可键入（数字 + 可选 m/g 单位），回车 / 失焦提交，
 * 非法值回退并提示，超限收敛到本机堆上限。
 * 上限由 SampleHostResources 检测物理内存后按 75% 折算（见 heapMemory.ts），
 * 检测不可用（纯浏览器预览 / 非 Windows 构建）时回落 32G 物理内存的口径。
 *
 * React 会把 range 的拖动 input 事件当作 onChange 持续触发，所以提交挂在原生
 * change（松手才发）上，拖动途中只更新填充与数值框显示，不写 store。
 */
export const HeapMemoryField: React.FC<{
  jvmArgs: string;
  disabled?: boolean;
  onChange: (jvmArgs: string) => void;
}> = ({ jvmArgs, disabled = false, onChange }) => {
  const { t } = useI18n();
  const [capGB, setCapGB] = useState<number | null>(null);
  /** 拖动 / 键入中的临时显示值；null 表示跟随受控值渲染。 */
  const [draft, setDraft] = useState<string | null>(null);
  /** 拖动中的档位下标。受控 range 若只在提交时写 store，React 会在每次
      重渲染时用旧 value 把滑块拉回原地（拖动手感变成弹回），所以拖动期间
      受控值直接跟随拖动位置，提交后清掉。 */
  const [draftIdx, setDraftIdx] = useState<number | null>(null);
  /** 悬浮气泡：跟随鼠标在滑杆上的位置，动态显示该处对应的内存档位。 */
  const [hoverTip, setHoverTip] = useState<{ px: number; gb: number } | null>(null);
  const rangeRef = useRef<HTMLInputElement>(null);

  const stops = useMemo(() => heapStopsForCap(capGB), [capGB]);

  /** 悬浮位置 → 档位：按 thumb 中心几何修正（原生 range 的有效行程是宽度减 thumb 宽）。 */
  const updateHoverTip = (event: React.MouseEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const thumb = 13;
    const usable = Math.max(0, rect.width - thumb);
    const px = Math.min(usable, Math.max(0, event.clientX - rect.left - thumb / 2));
    const ratio = usable > 0 ? px / usable : 0;
    const index = Math.round(ratio * (stops.length - 1));
    setHoverTip({ px: thumb / 2 + ratio * usable, gb: stops[index] });
  };

  useEffect(() => {
    let alive = true;
    SampleHostResources()
      .then((result) => {
        if (!alive || !result.success) {
          return;
        }
        const total = (result.data as { memory?: { total?: number } } | null | undefined)?.memory
          ?.total;
        if (typeof total === 'number' && total > 0) {
          setCapGB(heapCapFromTotalBytes(total));
        }
      })
      .catch(() => {
        // 没有后端采样时保持兜底口径，不打断添加流程。
      });
    return () => {
      alive = false;
    };
  }, []);

  /* 松手提交：原生 change 只在拖动结束 / 键盘调整后触发一次。
     始终读 jvmArgsRef（最新参数串），避免监听器闭包里的旧值丢掉其它参数。 */
  const jvmArgsRef = useRef(jvmArgs);
  jvmArgsRef.current = jvmArgs;
  useEffect(() => {
    const el = rangeRef.current;
    if (!el) {
      return;
    }
    const commit = () => {
      setDraft(null);
      setDraftIdx(null);
      commitHeap(stops[Number(el.value)]);
    };
    el.addEventListener('change', commit);
    return () => el.removeEventListener('change', commit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, stops]);

  /* 当前堆 = jvmArgs 串里的 -Xmx；没有 -Xmx 时按 2G 展示（拖动 / 键入会补上）。 */
  const currentGB = heapGBFromArgs(jvmArgs) ?? 2;
  const exact = stops.includes(currentGB);
  const idx = exact ? stops.indexOf(currentGB) : nearestStopIndex(stops, currentGB);
  const fillPct = `${((idx / (stops.length - 1)) * 100).toFixed(1)}%`;
  const display = draft ?? heapDisplayValue(currentGB, stops);
  const cap = stops[stops.length - 1];
  const min = stops[0];
  const totalGB = capGB ? Math.round(capGB / 0.75) : HEAP_FALLBACK_TOTAL_GB;

  /* jvmArgs 变化（含本组件提交 / 上方输入框手动编辑）后，拖动与键入草稿一律作废，
     滑块、填充与数值框回到由受控值推导的状态——三者永远跟随同一个数据源。 */
  useEffect(() => {
    setDraft(null);
    setDraftIdx(null);
  }, [jvmArgs]);

  /** 写入：-Xms/-Xmx 同值并保持在参数最前，其余参数保留原位。 */
  const commitHeap = (gb: number) => {
    const num = canonicalHeap(gb);
    const rest = String(jvmArgsRef.current || '')
      .split(/\s+/)
      .filter((arg) => arg && !/^-Xms/i.test(arg) && !/^-Xmx/i.test(arg));
    onChange(['-Xms' + num, '-Xmx' + num, ...rest].join(' '));
  };

  const commitInput = (raw: string) => {
    setDraft(null);
    setDraftIdx(null);
    const match = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*([mMgG]?)$/);
    if (!match) {
      message.warning(t('service.field.heap.formatError'));
      return;
    }
    const parsed = parseFloat(match[1]) * (match[2].toLowerCase() === 'm' ? 1 / 1024 : 1);
    if (!(parsed > 0)) {
      message.warning(t('service.field.heap.formatError'));
      return;
    }
    if (parsed > cap) {
      message.warning(t('service.field.heap.capClamp', { max: heapLabel(cap) }));
      commitHeap(cap);
      return;
    }
    if (parsed < min) {
      message.warning(t('service.field.heap.minClamp', { min: heapLabel(min) }));
      commitHeap(min);
      return;
    }
    commitHeap(parsed);
  };

  return (
    <div className="asm-heap-row">
      <span className="asm-heap-slider">
        {hoverTip && (
          <span className="asm-heap-tip" style={{ left: `${hoverTip.px}px` }}>
            {heapLabel(hoverTip.gb)}
          </span>
        )}
        <input
          ref={rangeRef}
          type="range"
          className="asm-heap-range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={draftIdx ?? idx}
          disabled={disabled}
          style={{ '--fill': fillPct } as React.CSSProperties}
          aria-label={t('service.field.heapShort')}
          onMouseMove={updateHoverTip}
          onMouseLeave={() => setHoverTip(null)}
          onInput={(event) => {
            const el = event.currentTarget;
            el.style.setProperty(
              '--fill',
              `${((Number(el.value) / (stops.length - 1)) * 100).toFixed(1)}%`,
            );
            setDraftIdx(Number(el.value));
            setDraft(heapLabel(stops[Number(el.value)]));
          }}
        />
      </span>
      <Tooltip
        title={t('service.field.heap.inputTip')}
        placement="top"
        overlayStyle={{ maxWidth: 560 }}
      >
        <input
          className="asm-input mono asm-heap-input"
          type="text"
          value={display}
          disabled={disabled}
          spellCheck={false}
          aria-label={t('service.field.heapShort')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitInput(event.currentTarget.value);
            }
          }}
          onBlur={(event) => {
            // 与受控显示一致（含大小写）时不重复提交，避免回车提交后失焦再写一次。
            const current = heapDisplayValue(currentGB, stops);
            if (event.currentTarget.value.trim() !== current) {
              commitInput(event.currentTarget.value);
            }
          }}
        />
      </Tooltip>
      <span
        className="asm-heap-cap"
        title={t('service.field.heap.capTip', { total: totalGB, max: heapLabel(cap) })}
      >
        {`${heapLabel(min)} – ${heapLabel(cap)} · ${t('service.field.heap.localCap')}`}
      </span>
    </div>
  );
};
