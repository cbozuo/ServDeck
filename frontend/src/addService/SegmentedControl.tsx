import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  /** 已翻译好的文案。这里不做 i18n，调用方拿到什么就渲染什么。 */
  label: React.ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** sm 对应旧的 .asm-compact-seg（24px 高），默认 md（26px） */
  size?: 'md' | 'sm';
  /**
   * 主题色滑块变体：选中项滑块填 accent 底色 + 反白文字。
   * 用于表单里的主选择（启动类型）；工具型分段（字段/原文切换）保持白滑块。
   */
  accent?: boolean;
  /** 无障碍名称，通常传该行的字段标签 */
  ariaLabel?: string;
  className?: string;
}

/**
 * 分段控件：选中态由一枚滑动的滑块承担，切换时滑块平移过去。
 *
 * 滑块位置按真实 DOM 测量（offsetLeft / offsetWidth），所以换语言、字体加载完成、
 * 选项文案变化都会自动对齐，不需要在 CSS 里算宽度。动画只跑 transform，
 * 走合成层，不触发重排。
 *
 * 首帧不播动画：挂载时先瞬时落位（is-animating 是在一帧之后才加上的），
 * 之后用户每次切换才有滑过去的动效，避免弹窗一打开滑块自己从左边滑过来。
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  accent = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, width: 0 });
  const [animate, setAnimate] = useState(false);

  const syncThumb = useCallback(() => {
    const box = listRef.current;
    if (!box) {
      return;
    }
    const active = box.querySelector<HTMLButtonElement>('button[aria-checked="true"]');
    if (!active) {
      setThumb({ x: 0, width: 0 });
      return;
    }
    // 用 rect 相减算偏移，不读 offsetLeft：thumb 是绝对定位元素，它的 left:0 落在容器的
    // padding box 左边缘，而 offsetLeft 的基准是 padding edge。容器有 padding 时两者会差
    // 一个 padding-left，滑块看起来会偏左 3px。
    const boxRect = box.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const borderLeft = parseFloat(window.getComputedStyle(box).borderLeftWidth) || 0;
    const next = {
      x: activeRect.left - boxRect.left - borderLeft,
      width: activeRect.width,
    };
    setThumb((prev) => (prev.x === next.x && prev.width === next.width ? prev : next));
  }, []);

  useLayoutEffect(syncThumb, [syncThumb, value, options]);

  // 字体加载完成后按钮宽度可能变，重新量一次。
  // 首帧也补一次：首次布局未完成时 rect 可能还是 0。
  useEffect(() => {
    const raf = requestAnimationFrame(syncThumb);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      void fonts.ready.then(syncThumb);
    }
    return () => cancelAnimationFrame(raf);
  }, [syncThumb]);

  // 容器尺寸变化时重新量：弹窗开场缩放动画期间 getBoundingClientRect 会拿到
  // 被 transform 缩放的宽度（46px 量成 9.2px），动画结束后 ResizeObserver 触发重测自愈。
  useEffect(() => {
    const box = listRef.current;
    if (!box || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => syncThumb());
    observer.observe(box);
    return () => observer.disconnect();
  }, [syncThumb]);

  // 一帧之后再开过渡，首帧瞬时落位。
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const classes = ['asm-seg'];
  if (size === 'sm') {
    classes.push('asm-compact-seg');
  }
  if (accent) {
    classes.push('asm-seg-accent');
  }
  if (className) {
    classes.push(className);
  }

  return (
    <div className={classes.join(' ')} ref={listRef} role="radiogroup" aria-label={ariaLabel}>
      <span
        className={animate ? 'asm-seg-thumb is-animating' : 'asm-seg-thumb'}
        aria-hidden="true"
        style={{ width: `${thumb.width}px`, transform: `translateX(${thumb.x}px)` }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            className={active ? 'on' : ''}
            onClick={() => {
              if (!active) {
                onChange(option.value);
              }
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
