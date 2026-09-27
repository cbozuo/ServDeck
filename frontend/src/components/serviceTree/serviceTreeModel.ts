import { SERVICE_TEMPLATE_LIST, type ServiceTemplate } from '../../addService/serviceTemplates';
import type { ManagedServiceEntry, ManagedServiceGroup } from '../../serviceRegistryStore';

/** 纳管服务树节点（渲染层再转成 antd TreeDataNode）。 */
export type ServiceTreeGroupNode = {
  key: string;
  type: 'group';
  group: ManagedServiceGroup;
  /** 过滤后组内服务数（整组因组名命中而保留时等于全量数）。 */
  services: ServiceTreeServiceNode[];
};

export type ServiceTreeServiceNode = {
  key: string;
  type: 'service';
  service: ManagedServiceEntry;
};

export type ServiceTreeData = {
  groups: ServiceTreeGroupNode[];
  ungrouped: ServiceTreeServiceNode[];
  /** 过滤后是否一个节点都没有（用于空态区分「无服务」与「无匹配」）。 */
  empty: boolean;
};

const normalizeFilter = (filter: string): string => filter.trim().toLowerCase();

const displayNameOf = (service: ManagedServiceEntry): string =>
  service.displayName?.trim() || service.name;

export const matchesServiceFilter = (service: ManagedServiceEntry, filter: string): boolean => {
  const needle = normalizeFilter(filter);
  if (!needle) return true;
  return (
    displayNameOf(service).toLowerCase().includes(needle)
    || service.name.toLowerCase().includes(needle)
  );
};

const byDisplayName = (a: ManagedServiceEntry, b: ManagedServiceEntry): number =>
  displayNameOf(a).localeCompare(displayNameOf(b)) || a.name.localeCompare(b.name);

/** 按服务类型找到展示模板（图标/类型名），未知类型返回 null。 */
export const resolveServiceTemplate = (serviceType: string): ServiceTemplate | null =>
  SERVICE_TEMPLATE_LIST.find((item) => item.id === serviceType) ?? null;

/**
 * 构建纳管服务树：一层分组 + 组内服务 + 根级未分组服务。
 * 过滤规则：命中服务名/显示名保留该服务（连带其分组），命中分组名保留整组。
 */
export function buildServiceTree(
  services: ManagedServiceEntry[],
  groups: ManagedServiceGroup[],
  filter: string,
): ServiceTreeData {
  const needle = normalizeFilter(filter);
  const sorted = [...services].sort(byDisplayName);
  const groupMatchesName = (group: ManagedServiceGroup): boolean =>
    Boolean(needle) && group.name.toLowerCase().includes(needle);

  const groupNodes = [...groups]
    .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt))
    .map<ServiceTreeGroupNode>((group) => {
      const all = sorted.filter((item) => item.groupId === group.id);
      const kept = groupMatchesName(group)
        ? all
        : all.filter((item) => matchesServiceFilter(item, filter));
      return {
        key: `group:${group.id}`,
        type: 'group',
        group,
        services: kept.map((service) => ({ key: `service:${service.name}`, type: 'service', service })),
      };
    });

  const ungrouped = sorted
    .filter((item) => item.groupId === null || !groups.some((group) => group.id === item.groupId))
    .filter((service) => matchesServiceFilter(service, filter))
    .map((service) => ({ key: `service:${service.name}`, type: 'service' as const, service }));

  const empty = groupNodes.every((node) => node.services.length === 0) && ungrouped.length === 0;
  return { groups: groupNodes, ungrouped, empty };
}

/** 过滤非空时分组全部默认展开。 */
export function collectGroupKeys(tree: ServiceTreeData): string[] {
  return tree.groups.map((node) => node.key);
}

/** 按 DOM 行 key 找回树节点（右键菜单入口）。 */
export function findServiceTreeTarget(
  tree: ServiceTreeData,
  key: string,
): ServiceTreeMenuTarget | null {
  for (const groupNode of tree.groups) {
    if (groupNode.key === key) {
      return { kind: 'group', group: groupNode.group };
    }
    for (const serviceNode of groupNode.services) {
      if (serviceNode.key === key) {
        return { kind: 'service', service: serviceNode.service };
      }
    }
  }
  for (const serviceNode of tree.ungrouped) {
    if (serviceNode.key === key) {
      return { kind: 'service', service: serviceNode.service };
    }
  }
  return null;
}

export type ServiceTreeMenuTarget =
  | { kind: 'group'; group: ManagedServiceGroup }
  | { kind: 'service'; service: ManagedServiceEntry };
