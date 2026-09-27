/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedServiceEntry } from './serviceRegistryStore';

const STORAGE_KEY = 'servdeck-managed-services-v1';

async function loadStore() {
  const mod = await import('./serviceRegistryStore');
  return mod.useServiceRegistryStore;
}

function makeEntry(overrides: Partial<ManagedServiceEntry> = {}): ManagedServiceEntry {
  return {
    name: 'svc-a',
    serviceType: 'nginx',
    displayName: 'Svc A',
    mode: 'manage',
    programFile: 'C:/nginx/nginx.exe',
    addedAt: '2026-09-28T00:00:00.000Z',
    groupId: null,
    ...overrides,
  };
}

describe('serviceRegistryStore 分组能力', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('读取 v1 旧格式（纯数组）时补齐 groupId 并保持数据', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { name: 'old-svc', serviceType: 'nginx', displayName: 'Old', mode: 'manage', programFile: 'x', addedAt: 't' },
    ]));
    const useStore = await loadStore();
    expect(useStore.getState().services).toHaveLength(1);
    expect(useStore.getState().services[0].groupId).toBeNull();
    expect(useStore.getState().groups).toEqual([]);
  });

  it('读取 v2 格式时还原 services 与 groups', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      services: [makeEntry({ groupId: 'g1' })],
      groups: [{ id: 'g1', name: '后台服务', createdAt: 't1' }],
    }));
    const useStore = await loadStore();
    expect(useStore.getState().groups[0]?.name).toBe('后台服务');
    expect(useStore.getState().services[0]?.groupId).toBe('g1');
  });

  it('addGroup 新建分组并持久化', async () => {
    const useStore = await loadStore();
    const group = useStore.getState().addGroup('后台服务');
    expect(useStore.getState().groups).toHaveLength(1);
    expect(group.name).toBe('后台服务');
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.version).toBe(2);
    expect(stored.groups).toHaveLength(1);
  });

  it('renameGroup 更新名称', async () => {
    const useStore = await loadStore();
    const group = useStore.getState().addGroup('A');
    useStore.getState().renameGroup(group.id, 'B');
    expect(useStore.getState().groups[0]?.name).toBe('B');
  });

  it('removeGroup 删除分组并把组内服务移回未分组', async () => {
    const useStore = await loadStore();
    const group = useStore.getState().addGroup('A');
    useStore.getState().addService(makeEntry({ name: 'svc-in-group', groupId: group.id }));
    useStore.getState().removeGroup(group.id);
    expect(useStore.getState().groups).toHaveLength(0);
    expect(useStore.getState().services[0]?.groupId).toBeNull();
  });

  it('moveServiceToGroup 移动服务并持久化', async () => {
    const useStore = await loadStore();
    const group = useStore.getState().addGroup('A');
    useStore.getState().addService(makeEntry());
    useStore.getState().moveServiceToGroup('svc-a', group.id);
    expect(useStore.getState().services[0]?.groupId).toBe(group.id);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.services[0]?.groupId).toBe(group.id);
  });

  it('addService 同名覆盖且保留最新', async () => {
    const useStore = await loadStore();
    useStore.getState().addService(makeEntry({ displayName: 'first' }));
    useStore.getState().addService(makeEntry({ displayName: 'second' }));
    const services = useStore.getState().services;
    expect(services).toHaveLength(1);
    expect(services[0]?.displayName).toBe('second');
  });
});
