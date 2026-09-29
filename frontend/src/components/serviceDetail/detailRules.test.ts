import { describe, expect, it } from 'vitest';
import { detailAvailability, heroActions, isInstalled, normalizeProcessState, type DetailPending } from './detailRules';

const base = { processState: 'Stopped', mode: 'managed', pending: null } as const;

describe('detailAvailability（state-rules §2 可用性矩阵）', () => {
  it('停止+托管：启动/注册/卸载可用，停止/重启拒绝', () => {
    expect(detailAvailability('start', base).allowed).toBe(true);
    expect(detailAvailability('register', base).allowed).toBe(true);
    expect(detailAvailability('uninstall', base).allowed).toBe(true);
    expect(detailAvailability('stop', base).reasonKey).toBe('detail.rule.notRunning');
    expect(detailAvailability('restart', base).reasonKey).toBe('detail.rule.notRunning');
  });

  it('运行+托管：停止/重启可用，启动/注册/卸载要求先停止', () => {
    const running = { ...base, processState: 'Running' } as const;
    expect(detailAvailability('stop', running).allowed).toBe(true);
    expect(detailAvailability('restart', running).allowed).toBe(true);
    expect(detailAvailability('start', running).reasonKey).toBe('detail.rule.alreadyRunning');
    expect(detailAvailability('register', running).reasonKey).toBe('detail.rule.stopBeforeRegister');
    expect(detailAvailability('uninstall', running).reasonKey).toBe('detail.rule.stopBeforeUninstall');
    expect(detailAvailability('editDeploy', running).reasonKey).toBe('detail.rule.stopBeforeEdit');
  });

  it('转场中：所有写操作拒绝', () => {
    for (const pending of ['starting', 'stopping', 'restarting', 'installing', 'uninstalling'] as DetailPending[]) {
      expect(detailAvailability('start', { ...base, pending }).reasonKey).toBe('detail.rule.pending');
      expect(detailAvailability('saveConf', { ...base, pending }).reasonKey).toBe('detail.rule.pending');
    }
  });

  it('纳管（adopted）：停止态注册（接入托管）与卸载（强确认）均可用，启停不受影响', () => {
    const adopted = { ...base, mode: 'adopted' } as const;
    expect(detailAvailability('register', adopted).allowed).toBe(true);
    expect(detailAvailability('uninstall', adopted).allowed).toBe(true);
    expect(detailAvailability('start', adopted).allowed).toBe(true);
  });

  it('Disabled 启动类型禁启动；deploy 缺失禁编辑部署参数', () => {
    expect(detailAvailability('start', { ...base, startTypeDisabled: true }).reasonKey).toBe('detail.rule.startDisabled');
    expect(detailAvailability('editDeploy', { ...base, deployMissing: true }).reasonKey).toBe('detail.rule.deployMissing');
  });

  it('未注册（installed=false）：启停重启卸载全部拒绝，注册（装入）与参数编辑仍可用', () => {
    const unreg = { ...base, installed: false } as const;
    for (const action of ['start', 'stop', 'restart', 'uninstall'] as const) {
      expect(detailAvailability(action, unreg).reasonKey).toBe('detail.rule.notInstalled');
    }
    expect(detailAvailability('register', unreg).allowed).toBe(true);
    expect(detailAvailability('editDeploy', unreg).allowed).toBe(true);
    // 运行态不会出现在未注册服务上，但规则仍保证 pending 优先
    expect(detailAvailability('start', { ...unreg, pending: 'starting' }).reasonKey).toBe('detail.rule.pending');
  });

  it('isInstalled：缺省视为已注册，仅显式 false 为未注册', () => {
    expect(isInstalled(base)).toBe(true);
    expect(isInstalled({ ...base, installed: undefined })).toBe(true);
    expect(isInstalled({ ...base, installed: false })).toBe(false);
  });
});

describe('heroActions 与状态归一化', () => {
  it('托管五命令、纳管四命令（无重新注册，卸载走强确认）', () => {
    expect(heroActions('managed')).toHaveLength(5);
    expect(heroActions('adopted')).toEqual(['start', 'stop', 'restart', 'uninstall']);
  });

  it('中间态归入 Pending，未知归入 Unknown', () => {
    expect(normalizeProcessState('StartPending', null)).toBe('Pending');
    expect(normalizeProcessState('Unknown', null)).toBe('Unknown');
    expect(normalizeProcessState('Running', 'stopping')).toBe('Pending');
  });
});
