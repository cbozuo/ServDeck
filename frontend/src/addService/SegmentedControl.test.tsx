/** @vitest-environment jsdom */
import React from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

type Value = 'auto' | 'delayed' | 'manual';

const OPTIONS: Array<{ value: Value; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'delayed', label: '自动（延迟）' },
  { value: 'manual', label: '手动' },
];

function render(value: Value, onChange = vi.fn(), extra?: { disabled?: boolean }) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <SegmentedControl
        options={
          extra?.disabled
            ? OPTIONS.map((option) => ({ ...option, disabled: option.value === 'manual' }))
            : OPTIONS
        }
        value={value}
        onChange={onChange}
        ariaLabel="启动类型"
      />,
    );
  });
  return { renderer, onChange };
}

describe('SegmentedControl', () => {
  it('渲染 radiogroup，选中项带 aria-checked', () => {
    const { renderer } = render('delayed');
    const group = renderer.root.findByType('div');
    expect(group.props.role).toBe('radiogroup');
    expect(group.props['aria-label']).toBe('启动类型');

    const radios = renderer.root.findAll((node) => node.props?.role === 'radio');
    expect(radios).toHaveLength(3);
    expect(radios.map((node) => node.props['aria-checked'])).toEqual([false, true, false]);
    expect(radios.map((node) => node.props.className)).toEqual(['', 'on', '']);
  });

  it('点击未选中项触发 onChange，点击已选中项不触发', () => {
    const { renderer, onChange } = render('auto');
    const radios = renderer.root.findAll((node) => node.props?.role === 'radio');

    act(() => radios[1].props.onClick());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('delayed');

    act(() => radios[0].props.onClick());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled 的选项带着 disabled 属性透传到按钮', () => {
    const { renderer } = render('auto', vi.fn(), { disabled: true });
    const radios = renderer.root.findAll((node) => node.props?.role === 'radio');
    expect(radios[2].props.disabled).toBe(true);
    expect(radios[0].props.disabled).toBe(false);
  });

  it('滑块始终渲染，宽度与位移都写在 style 上供 CSS 过渡', () => {
    const { renderer } = render('auto');
    const thumb = renderer.root.find((node) => node.props?.className?.includes('asm-seg-thumb'));
    expect(thumb.props['aria-hidden']).toBe('true');
    // jsdom 不做布局，这里只断言样式字段存在；真实位置由浏览器测量，见 .workbuddy 下的校验页。
    expect(typeof thumb.props.style.width).toBe('string');
    expect(typeof thumb.props.style.transform).toBe('string');
  });
});
