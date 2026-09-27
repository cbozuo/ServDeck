import { describe, expect, it } from 'vitest';
import type { ManagedServiceEntry, ManagedServiceGroup } from '../../serviceRegistryStore';
import {
  buildServiceTree,
  collectGroupKeys,
  findServiceTreeTarget,
  matchesServiceFilter,
  resolveServiceTemplate,
} from './serviceTreeModel';

function entry(overrides: Partial<ManagedServiceEntry>): ManagedServiceEntry {
  return {
    name: 'svc',
    serviceType: 'nginx',
    displayName: '',
    mode: 'manage',
    programFile: '',
    addedAt: '',
    groupId: null,
    ...overrides,
  };
}

const groups: ManagedServiceGroup[] = [
  { id: 'g1', name: '后台服务', createdAt: '2026-01-02' },
  { id: 'g2', name: '网关', createdAt: '2026-01-01' },
];

describe('buildServiceTree', () => {
  it('按名称排序分组，组内按显示名排序，孤儿 groupId 回到未分组', () => {
    const services = [
      entry({ name: 'b', displayName: 'B服务', groupId: 'g2' }),
      entry({ name: 'a', displayName: 'A服务', groupId: 'g1' }),
      entry({ name: 'c', displayName: 'C服务', groupId: 'missing-group' }),
      entry({ name: 'd', displayName: 'D服务' }),
    ];
    const tree = buildServiceTree(services, groups, '');
    // localeCompare 默认 ICU 序：'后台服务'(hou) 排在 '网关'(wang) 之前。
    expect(tree.groups.map((group) => group.group.id)).toEqual(['g1', 'g2']);
    expect(tree.groups[0]?.services[0]?.service.name).toBe('a');
    expect(tree.groups[1]?.services[0]?.service.name).toBe('b');
    expect(tree.ungrouped.map((node) => node.service.name)).toEqual(['c', 'd']);
    expect(tree.empty).toBe(false);
  });

  it('按显示名与 SCM 服务名匹配过滤，未命中分组被剔除', () => {
    const services = [
      entry({ name: 'nginx-core', displayName: '核心网关', groupId: 'g2' }),
      entry({ name: 'mysql-local', displayName: '本地数据库' }),
    ];
    const byDisplayName = buildServiceTree(services, groups, '核心');
    expect(byDisplayName.ungrouped).toHaveLength(0);
    expect(byDisplayName.groups.find((group) => group.group.id === 'g2')?.services).toHaveLength(1);
    expect(byDisplayName.groups.find((group) => group.group.id === 'g1')?.services).toHaveLength(0);

    const byScmName = buildServiceTree(services, groups, 'MYSQL-LOCAL');
    expect(byScmName.ungrouped).toHaveLength(1);
  });

  it('分组名命中时保留整组服务', () => {
    const services = [
      entry({ name: 'x', displayName: 'X', groupId: 'g1' }),
      entry({ name: 'y', displayName: 'Y', groupId: 'g1' }),
    ];
    const tree = buildServiceTree(services, groups, '后台');
    expect(tree.groups.find((group) => group.group.id === 'g1')?.services).toHaveLength(2);
  });

  it('全部被过滤掉时 empty 为 true', () => {
    const tree = buildServiceTree([entry({ name: 'a', displayName: 'A' })], groups, 'zzz');
    expect(tree.empty).toBe(true);
  });
});

describe('matchesServiceFilter / collectGroupKeys / resolveServiceTemplate', () => {
  it('过滤器 trim 大小写不敏感', () => {
    expect(matchesServiceFilter(entry({ displayName: 'My Nginx' }), '  nginx ')).toBe(true);
    expect(matchesServiceFilter(entry({ displayName: 'My Nginx' }), 'redis')).toBe(false);
  });

  it('collectGroupKeys 返回全部分组 key', () => {
    expect(collectGroupKeys(buildServiceTree([], groups, ''))).toEqual(['group:g1', 'group:g2']);
  });

  it('resolveServiceTemplate 支持已知类型并对未知类型返回 null', () => {
    expect(resolveServiceTemplate('mysql')?.id).toBe('mysql');
    expect(resolveServiceTemplate('not-a-type')).toBeNull();
  });
});

describe('findServiceTreeTarget', () => {
  it('能找回分组与服务节点，未知 key 返回 null', () => {
    const services = [entry({ name: 'a', groupId: 'g1' })];
    const tree = buildServiceTree(services, groups, '');
    expect(findServiceTreeTarget(tree, 'group:g1')?.kind).toBe('group');
    expect(findServiceTreeTarget(tree, 'service:a')?.kind).toBe('service');
    expect(findServiceTreeTarget(tree, 'service:zzz')).toBeNull();
  });
});
