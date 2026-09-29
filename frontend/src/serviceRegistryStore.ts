import { create } from 'zustand';

/** 已加入纳管的服务记录（本地持久化；左侧纳管服务树的数据源）。 */
export interface ManagedServiceEntry {
  /** SCM 服务名（唯一键） */
  name: string;
  serviceType: string;
  displayName: string;
  /** 加入方式：register = 由 servy 注册；manage = 纳管已有服务 */
  mode: 'register' | 'manage';
  programFile: string;
  logDir?: string;
  addedAt: string;
  /** 所属分组；null = 未分组（树根）。 */
  groupId: string | null;
  /**
   * 用户在外观 tab 挑的自定义图标（上传图片的 data URL，或图标变体路径）。
   * 留空表示沿用服务类型的默认图标。两个字段都是可选的，旧记录读进来自然是 undefined。
   */
  iconDataUrl?: string;
  /** 用户挑的主色。留空表示用类型默认色。 */
  accentColor?: string;
  /**
   * 注册参数快照（servy 托管注册时录入）：详情页部署参数与「重新注册」的数据源。
   * manage 纳管记录与旧版本记录没有该字段 → 部署页显示「参数未知，需重新注册」空态。
   */
  deploy?: ServiceDeploySnapshot;
}

/** 注册参数快照（对应 servy-cli install 的可编辑参数；派生字段不存，渲染时推导）。 */
export interface ServiceDeploySnapshot {
  displayName: string;
  description?: string;
  programFile: string;
  workDir?: string;
  /** Java：JVM 可执行路径；其他类型为空 */
  javaPath?: string;
  /** Java：JVM 参数（含 -Xms/-Xmx 等） */
  jvmArgs?: string;
  /** 非 Java：应用参数 */
  params?: string;
  startType: string;
  restart: boolean;
  /** 日志按大小轮转（--enableSizeRotation）；旧快照缺省跟随 restart */
  rotate?: boolean;
  confName?: string;
  confContent?: string;
}

/** 纳管服务的分组（一层，树上的文件夹节点）。 */
export interface ManagedServiceGroup {
  id: string;
  name: string;
  createdAt: string;
}

const STORAGE_KEY = 'servdeck-managed-services-v1';

interface ManagedServicesState {
  services: ManagedServiceEntry[];
  groups: ManagedServiceGroup[];
  addService: (entry: ManagedServiceEntry) => void;
  removeService: (name: string) => void;
  addGroup: (name: string) => ManagedServiceGroup;
  renameGroup: (id: string, name: string) => void;
  /** 删除分组；组内服务回到未分组，不会删除服务本身。 */
  removeGroup: (id: string) => void;
  moveServiceToGroup: (name: string, groupId: string | null) => void;
}

type StoredShape = {
  version: 2;
  services: ManagedServiceEntry[];
  groups: ManagedServiceGroup[];
};

/** v1 只存服务数组；读到旧格式时补齐 groupId 并迁移为 v2 形态。 */
function normalizeLegacyEntry(entry: ManagedServiceEntry | Record<string, unknown>): ManagedServiceEntry {
  return {
    ...(entry as ManagedServiceEntry),
    groupId: (entry as ManagedServiceEntry).groupId ?? null,
  };
}

function parseStored(raw: string): { services: ManagedServiceEntry[]; groups: ManagedServiceGroup[] } {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return { services: parsed.map(normalizeLegacyEntry), groups: [] };
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.services)) {
    return {
      services: parsed.services.map(normalizeLegacyEntry),
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    };
  }
  return { services: [], groups: [] };
}

function loadFromStorage(): { services: ManagedServiceEntry[]; groups: ManagedServiceGroup[] } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { services: [], groups: [] };
    }
    return parseStored(raw);
  } catch {
    return { services: [], groups: [] };
  }
}

function persist(state: { services: ManagedServiceEntry[]; groups: ManagedServiceGroup[] }): void {
  const payload: StoredShape = {
    version: 2,
    services: state.services,
    groups: state.groups,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 本地持久化失败不影响功能（如隐私模式），仅失去跨会话记忆。
  }
}

export const useServiceRegistryStore = create<ManagedServicesState>((set) => ({
  ...loadFromStorage(),
  addService: (entry) =>
    set((state) => {
      const rest = state.services.filter((item) => item.name !== entry.name);
      const services = [entry, ...rest];
      persist({ services, groups: state.groups });
      return { services };
    }),
  removeService: (name) =>
    set((state) => {
      const services = state.services.filter((item) => item.name !== name);
      persist({ services, groups: state.groups });
      return { services };
    }),
  addGroup: (name) => {
    const group: ManagedServiceGroup = {
      id: `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const groups = [...state.groups, group];
      persist({ services: state.services, groups });
      return { groups };
    });
    return group;
  },
  renameGroup: (id, name) =>
    set((state) => {
      const groups = state.groups.map((group) => (group.id === id ? { ...group, name } : group));
      persist({ services: state.services, groups });
      return { groups };
    }),
  removeGroup: (id) =>
    set((state) => {
      const groups = state.groups.filter((group) => group.id !== id);
      const services = state.services.map((item) =>
        item.groupId === id ? { ...item, groupId: null } : item,
      );
      persist({ services, groups });
      return { groups, services };
    }),
  moveServiceToGroup: (name, groupId) =>
    set((state) => {
      const services = state.services.map((item) =>
        item.name === name ? { ...item, groupId } : item,
      );
      persist({ services, groups: state.groups });
      return { services };
    }),
}));
