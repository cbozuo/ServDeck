import { describe, expect, it } from 'vitest';
import { diffServiceStates, isPendingState } from './homeEvents';

const snap = (name: string, displayName: string, state: string) => ({ name, displayName, state });

describe('isPendingState', () => {
  it('四种 pending 状态返回 true', () => {
    expect(isPendingState('StartPending')).toBe(true);
    expect(isPendingState('StopPending')).toBe(true);
    expect(isPendingState('ContinuePending')).toBe(true);
    expect(isPendingState('PausePending')).toBe(true);
  });

  it('终态返回 false', () => {
    expect(isPendingState('Running')).toBe(false);
    expect(isPendingState('Stopped')).toBe(false);
    expect(isPendingState('Unknown')).toBe(false);
  });
});

describe('diffServiceStates', () => {
  it('首次采样不产生事件', () => {
    const drafts = diffServiceStates(new Map(), [snap('a', 'A', 'Stopped')], 1000);
    expect(drafts).toEqual([]);
  });

  it('状态未变化不产生事件', () => {
    const prev = new Map([['a', 'Running']]);
    const drafts = diffServiceStates(prev, [snap('a', 'A', 'Running')], 1000);
    expect(drafts).toEqual([]);
  });

  it('停止到运行记为启动事件', () => {
    const prev = new Map([['a', 'Stopped']]);
    const drafts = diffServiceStates(prev, [snap('a', 'MySQL80', 'Running')], 1000);
    expect(drafts).toEqual([{ at: 1000, level: 'run', name: 'a', service: 'MySQL80', key: 'home.events.started' }]);
  });

  it('运行到停止记为停止事件', () => {
    const prev = new Map([['a', 'Running']]);
    const drafts = diffServiceStates(prev, [snap('a', 'MySQL80', 'Stopped')], 1000);
    expect(drafts).toEqual([{ at: 1000, level: 'info', name: 'a', service: 'MySQL80', key: 'home.events.stopped' }]);
  });

  it('迁移到未知状态记为异常事件并带状态参数', () => {
    const prev = new Map([['a', 'Running']]);
    const drafts = diffServiceStates(prev, [snap('a', 'Redis', 'Paused')], 1000);
    expect(drafts).toEqual([
      { at: 1000, level: 'err', name: 'a', service: 'Redis', key: 'home.events.abnormal', params: { state: 'Paused' } },
    ]);
  });

  it('进入 pending 的迁移不产生事件（防状态抖动噪音）', () => {
    const prev = new Map([['a', 'Running']]);
    expect(diffServiceStates(prev, [snap('a', 'A', 'StopPending')], 1000)).toEqual([]);
  });

  it('从 pending 进入终态要产生事件（启动失败场景）', () => {
    const prev = new Map([['a', 'StartPending']]);
    const drafts = diffServiceStates(prev, [snap('a', 'A', 'Stopped')], 1000);
    expect(drafts).toEqual([{ at: 1000, level: 'info', name: 'a', service: 'A', key: 'home.events.stopped' }]);
  });

  it('从 pending 进入 Running 记为启动事件', () => {
    const prev = new Map([['a', 'StartPending']]);
    const drafts = diffServiceStates(prev, [snap('a', 'A', 'Running')], 1000);
    expect(drafts).toEqual([{ at: 1000, level: 'run', name: 'a', service: 'A', key: 'home.events.started' }]);
  });

  it('多个服务同时变化各自产生事件', () => {
    const prev = new Map([
      ['a', 'Stopped'],
      ['b', 'Running'],
    ]);
    const next = [snap('a', 'A', 'Running'), snap('b', 'B', 'Stopped')];
    const drafts = diffServiceStates(prev, next, 1000);
    expect(drafts).toHaveLength(2);
    expect(drafts.map((d) => d.level)).toEqual(['run', 'info']);
  });
});
