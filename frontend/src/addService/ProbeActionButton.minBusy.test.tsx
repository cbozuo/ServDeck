/** @vitest-environment jsdom */
import React from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProbeActionButton } from './ProbeActionButton';

vi.mock('../i18n/provider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const labelOf = (instance: ReactTestRenderer): string => {
  const label = instance.root.findByProps({ className: 'asm-probe-label' });
  return String(label.children.join(''));
};

const disabledOf = (instance: ReactTestRenderer): boolean => {
  const button = instance.root.findByType('button');
  return Boolean(button.props.disabled);
};

describe('ProbeActionButton 最短探测中时长', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('真实探测很快返回时，busy 态仍补足最短展示时长（回归：定时器被清导致卡死）', async () => {
    let instance!: ReactTestRenderer;
    await act(async () => {
      instance = create(<ProbeActionButton probing={false} phase="none" onProbe={() => undefined} />);
    });

    // 开始探测
    await act(async () => {
      instance.update(<ProbeActionButton probing phase="probing" onProbe={() => undefined} />);
    });
    expect(labelOf(instance)).toBe('service.modal.probe.probing');
    expect(disabledOf(instance)).toBe(true);

    // 100ms 后真实探测返回（远小于最短时长）
    await act(async () => {
      vi.advanceTimersByTime(100);
      instance.update(<ProbeActionButton probing={false} phase="ok" onProbe={() => undefined} />);
    });
    // 关键断言：仍处于 busy（旧实现在此处清掉定时器，minBusy 卡死/或一闪而过）
    expect(labelOf(instance)).toBe('service.modal.probe.probing');
    expect(disabledOf(instance)).toBe(true);

    // 补足 400ms 后回落到「重新探测」
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(labelOf(instance)).toBe('service.modal.probe.again');
    expect(disabledOf(instance)).toBe(false);
  });

  it('探测本身耗时超过最短时长时不额外拖延', async () => {
    let instance!: ReactTestRenderer;
    await act(async () => {
      instance = create(<ProbeActionButton probing={false} phase="none" onProbe={() => undefined} />);
    });
    await act(async () => {
      instance.update(<ProbeActionButton probing phase="probing" onProbe={() => undefined} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
      instance.update(<ProbeActionButton probing={false} phase="ok" onProbe={() => undefined} />);
    });
    expect(labelOf(instance)).toBe('service.modal.probe.again');
    expect(disabledOf(instance)).toBe(false);
  });
});
