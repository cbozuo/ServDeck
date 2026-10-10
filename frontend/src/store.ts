import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isNativeDetachedWindowRoute } from "./utils/nativeDetachedWindowRoute";
import {
  ConnectionConfig,
  SavedConnection,
  TabData,
  JVMDiagnosticCommandDraft,
  JVMDiagnosticEventChunk,
} from "./types";
import {
  ShortcutAction,
  ShortcutOptions,
  DEFAULT_SHORTCUT_OPTIONS,
  cloneShortcutOptions,
  getShortcutPlatform,
  migrateLegacySidebarSearchShortcutOptions,
  sanitizeShortcutOptions,
  type ShortcutPlatformBinding,
  type ShortcutPlatform,
} from "./utils/shortcuts";
import {
  DEFAULT_DATA_GRID_DISPLAY_SETTINGS,
  sanitizeDataGridDisplaySettings,
  type DataGridDisplaySettings,
} from "./utils/dataGridDisplay";
import {
  DEFAULT_SQL_EDITOR_TYPOGRAPHY_SETTINGS,
  migrateLegacySqlEditorTypographySettings,
  sanitizeSqlEditorTypographySettings,
  type SqlEditorTypographySettings,
} from "./utils/sqlEditorTypography";
import { sanitizeFontFamilyInput } from "./utils/fontFamilies";
import {
  createDefaultDetachedBounds,
  nextDetachedZIndex,
  type DetachedWorkbenchWindow,
  type DetachedWindowBounds,
} from "./utils/detachedWindow";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_PREFERENCES,
  resolveLanguage,
  type LanguagePreference,
} from "./i18n";
import {
  DEFAULT_TAB_DISPLAY_SETTINGS,
  sanitizeTabDisplaySettings,
  type TabDisplaySettings,
} from "./utils/tabDisplay";
import {
  deriveLegacyConnectionReadOnlyFlag,
  normalizeConnectionProtectionConfig,
  resolveConnectionProtectionConfig,
} from "./utils/connectionReadOnly";
import { sanitizeSidebarWidth } from "./utils/sidebarLayout";
import { createDebouncedPersistStorage } from "./utils/debouncedPersistStorage";
import {
  DEFAULT_TOOLBAR_BUTTON_COLOR_OVERRIDES,
  sanitizeToolbarButtonColorOverrides,
  type ToolbarButtonColorOverrides,
} from "./utils/toolbarAppearance";
import {
  DEFAULT_BRAND_ICON_ID,
} from "./brand/brandIcons";

const sanitizeBrandIconIdLocal = (_value: unknown): string =>
  DEFAULT_BRAND_ICON_ID;

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

export interface AppearanceSettings
  extends DataGridDisplaySettings, SqlEditorTypographySettings {
  enabled: boolean;
  opacity: number;
  blur: number;
  v2SidebarRailScale: number;
  tabEnvironmentAccentThickness: number;
  toolbarButtonColorOverrides: ToolbarButtonColorOverrides;
  customUIFontFamily: string | null;
  customMonoFontFamily: string | null;
  tabDisplay: TabDisplaySettings;
}

export const DEFAULT_V2_SIDEBAR_RAIL_SCALE = 1.0;
export const MIN_V2_SIDEBAR_RAIL_SCALE = 1.0;
export const MAX_V2_SIDEBAR_RAIL_SCALE = 1.8;
export const DEFAULT_TAB_ENVIRONMENT_ACCENT_THICKNESS = 2;
export const MIN_TAB_ENVIRONMENT_ACCENT_THICKNESS = 1;
export const MAX_TAB_ENVIRONMENT_ACCENT_THICKNESS = 6;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  enabled: true,
  opacity: 1.0,
  blur: 0,
  v2SidebarRailScale: DEFAULT_V2_SIDEBAR_RAIL_SCALE,
  tabEnvironmentAccentThickness: DEFAULT_TAB_ENVIRONMENT_ACCENT_THICKNESS,
  toolbarButtonColorOverrides: { ...DEFAULT_TOOLBAR_BUTTON_COLOR_OVERRIDES },
  customUIFontFamily: null,
  customMonoFontFamily: null,
  tabDisplay: DEFAULT_TAB_DISPLAY_SETTINGS,
  ...DEFAULT_DATA_GRID_DISPLAY_SETTINGS,
  ...DEFAULT_SQL_EDITOR_TYPOGRAPHY_SETTINGS,
};
const DEFAULT_UI_SCALE = 1.0;
const MIN_UI_SCALE = 0.8;
const MAX_UI_SCALE = 1.25;
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 20;
const DEFAULT_STARTUP_FULLSCREEN = false;
const DEFAULT_AUTO_CHECK_FOR_UPDATES = false;
/** 自动检查更新间隔（分钟）；与关于页 Select 选项保持一致 */
export const AUTO_CHECK_FOR_UPDATES_INTERVAL_OPTIONS = [
  15, 30, 60, 120, 360, 720, 1440,
] as const;
const DEFAULT_AUTO_CHECK_FOR_UPDATES_INTERVAL_MINUTES = 30;
const AUTO_CHECK_FOR_UPDATES_INTERVAL_OPTIONS_SET = new Set<number>(
  AUTO_CHECK_FOR_UPDATES_INTERVAL_OPTIONS,
);
const PERSIST_VERSION = 21;
const SQL_EDITOR_FONT_SIZE_SPLIT_VERSION = 19;
const TAB_DISPLAY_DEFAULT_MIGRATION_VERSION = 20;
const SIDEBAR_SEARCH_SHORTCUT_MIGRATION_VERSION = 18;
const PERSIST_STORAGE_KEY = "lite-db-storage";
const PERSIST_WRITE_DEBOUNCE_MS = 160;
const MAX_RUNTIME_SQL_LOGS = 120;
const MAX_RUNTIME_SQL_LOG_LENGTH = 12 * 1024;
const MAX_RUNTIME_SQL_LOG_MESSAGE_LENGTH = 1024;
const MAX_PERSISTED_SQL_LOGS = 200;
const MAX_PERSISTED_SQL_LOG_LENGTH = 24 * 1024;
const MAX_PERSISTED_SQL_LOG_MESSAGE_LENGTH = 2 * 1024;
const DEFAULT_CONNECTION_TYPE = "jvm";
const DEFAULT_JVM_PORT = 9010;
const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = "system";

const isFrontendTestRuntime = (): boolean => {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env || {};
  return env.MODE === "test" || env.VITEST === true || env.VITEST === "true";
};

const writePersistedStatePatch = (
  patch: Record<string, unknown>,
): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const payload = localStorage.getItem(PERSIST_STORAGE_KEY);
    const raw =
      payload && payload.trim() !== ""
        ? (JSON.parse(payload) as Record<string, unknown>)
        : {};
    const state = unwrapPersistedAppState(raw);
    localStorage.setItem(
      PERSIST_STORAGE_KEY,
      JSON.stringify({
        ...raw,
        state: {
          ...state,
          ...patch,
        },
        version:
          typeof raw.version === "number" ? raw.version : PERSIST_VERSION,
      }),
    );
  } catch {
    // ignore
  }
};

const toTrimmedString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return fallback;
};

const normalizeIntegerInRange = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
  return clamped;
};

const normalizeFloatInRange = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizePort = (value: unknown, fallbackPort: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackPort;
  const port = Math.round(parsed);
  if (port < 1 || port > 65535) return fallbackPort;
  return port;
};

const sanitizeStringArray = (value: unknown, maxLength = 256): string[] => {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  value.forEach((entry) => {
    const trimmed = toTrimmedString(entry);
    if (!trimmed) return;
    result.push(trimmed.slice(0, maxLength));
  });
  return result;
};

const sanitizeAddressList = (value: unknown): string[] => {
  return sanitizeStringArray(value, 512)
    .filter((entry) => entry.length > 0)
    .slice(0, 64);
};

const sanitizeConnectionIconType = (value: unknown): string | undefined => {
  const iconType = toTrimmedString(value).toLowerCase();
  return iconType || undefined;
};

const sanitizeConnectionIconColor = (value: unknown): string | undefined => {
  const color = toTrimmedString(value);
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)
    ? color
    : undefined;
};

/** 连接类型别名归一：只保留 JVM 服务诊断所需的宽松映射。 */
const normalizeConnectionType = (value: unknown): string => {
  const type = toTrimmedString(value).toLowerCase();
  if (!type) return DEFAULT_CONNECTION_TYPE;
  if (type === "jvm" || type === "java" || type === "jvm-service") return "jvm";
  return type;
};

const getConnectionTypeDefaultPort = (type: string): number => (
  type === "jvm" ? DEFAULT_JVM_PORT : 3306
);

const sanitizeJVMModes = (
  value: unknown,
): Array<"jmx" | "endpoint" | "agent"> => {
  if (!Array.isArray(value)) return ["jmx"];
  const result: Array<"jmx" | "endpoint" | "agent"> = [];
  const seen = new Set<"jmx" | "endpoint" | "agent">();
  value.forEach((entry) => {
    const normalized = toTrimmedString(entry).toLowerCase();
    if (
      normalized !== "jmx" &&
      normalized !== "endpoint" &&
      normalized !== "agent"
    )
      return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result.length > 0 ? result : ["jmx"];
};

const sanitizeJVMConfig = (
  value: unknown,
  options: {
    host: string;
    port: number;
    timeout: number;
    persistSecrets: boolean;
  },
): ConnectionConfig["jvm"] => {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const allowedModes = sanitizeJVMModes(raw.allowedModes);
  const preferredModeRaw = toTrimmedString(raw.preferredMode).toLowerCase();
  const preferredMode = allowedModes.includes(
    preferredModeRaw as "jmx" | "endpoint" | "agent",
  )
    ? (preferredModeRaw as "jmx" | "endpoint" | "agent")
    : allowedModes[0];
  const environmentRaw = toTrimmedString(raw.environment, "dev").toLowerCase();
  const environment: "dev" | "uat" | "prod" =
    environmentRaw === "uat"
      ? "uat"
      : environmentRaw === "prod"
        ? "prod"
        : "dev";
  const jmxRaw =
    raw.jmx && typeof raw.jmx === "object"
      ? (raw.jmx as Record<string, unknown>)
      : {};
  const endpointRaw =
    raw.endpoint && typeof raw.endpoint === "object"
      ? (raw.endpoint as Record<string, unknown>)
      : {};
  const agentRaw =
    raw.agent && typeof raw.agent === "object"
      ? (raw.agent as Record<string, unknown>)
      : {};
  const diagnosticRaw =
    raw.diagnostic && typeof raw.diagnostic === "object"
      ? (raw.diagnostic as Record<string, unknown>)
      : {};
  const diagnosticTransportRaw = toTrimmedString(
    diagnosticRaw.transport,
    "agent-bridge",
  ).toLowerCase();
  const diagnosticTransport =
    diagnosticTransportRaw === "arthas-tunnel"
      ? "arthas-tunnel"
      : "agent-bridge";
  const fallbackPort = options.port > 0 ? options.port : DEFAULT_JVM_PORT;
  const fallbackTimeout =
    options.timeout > 0 ? options.timeout : DEFAULT_TIMEOUT_SECONDS;

  return {
    environment,
    readOnly: typeof raw.readOnly === "boolean" ? raw.readOnly : true,
    allowedModes,
    preferredMode,
    jmx: {
      enabled: jmxRaw.enabled === true || allowedModes.includes("jmx"),
      host: toTrimmedString(jmxRaw.host, options.host) || options.host,
      port: normalizePort(jmxRaw.port, fallbackPort),
      username: toTrimmedString(jmxRaw.username),
      password: options.persistSecrets ? toTrimmedString(jmxRaw.password) : "",
      domainAllowlist: sanitizeStringArray(jmxRaw.domainAllowlist, 256),
    },
    endpoint: {
      enabled: endpointRaw.enabled === true,
      baseUrl: toTrimmedString(endpointRaw.baseUrl),
      apiKey: options.persistSecrets ? toTrimmedString(endpointRaw.apiKey) : "",
      timeoutSeconds: normalizeIntegerInRange(
        endpointRaw.timeoutSeconds,
        fallbackTimeout,
        1,
        MAX_TIMEOUT_SECONDS,
      ),
    },
    agent: {
      enabled: agentRaw.enabled === true,
      baseUrl: toTrimmedString(agentRaw.baseUrl),
      apiKey: options.persistSecrets ? toTrimmedString(agentRaw.apiKey) : "",
      timeoutSeconds: normalizeIntegerInRange(
        agentRaw.timeoutSeconds,
        fallbackTimeout,
        1,
        MAX_TIMEOUT_SECONDS,
      ),
    },
    diagnostic: {
      enabled: diagnosticRaw.enabled === true,
      transport: diagnosticTransport,
      baseUrl: toTrimmedString(diagnosticRaw.baseUrl),
      targetId: toTrimmedString(diagnosticRaw.targetId),
      apiKey: options.persistSecrets
        ? toTrimmedString(diagnosticRaw.apiKey)
        : "",
      allowObserveCommands: diagnosticRaw.allowObserveCommands !== false,
      allowTraceCommands: diagnosticRaw.allowTraceCommands === true,
      allowMutatingCommands: diagnosticRaw.allowMutatingCommands === true,
      timeoutSeconds: normalizeIntegerInRange(
        diagnosticRaw.timeoutSeconds,
        DEFAULT_DIAGNOSTIC_TIMEOUT_SECONDS,
        1,
        MAX_DIAGNOSTIC_TIMEOUT_SECONDS,
      ),
    },
  };
};

const MAX_URI_LENGTH = 4096;
const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 3600;
const DEFAULT_DIAGNOSTIC_TIMEOUT_SECONDS = 15;
const MAX_DIAGNOSTIC_TIMEOUT_SECONDS = 300;

const sanitizeConnectionConfig = (value: unknown): ConnectionConfig => {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const type = normalizeConnectionType(raw.type);
  const defaultPort = getConnectionTypeDefaultPort(type);
  const savePassword =
    typeof raw.savePassword === "boolean" ? raw.savePassword : true;

  const sshRaw =
    raw.ssh && typeof raw.ssh === "object"
      ? (raw.ssh as Record<string, unknown>)
      : {};
  const ssh = {
    host: toTrimmedString(sshRaw.host),
    port: normalizePort(sshRaw.port, 22),
    user: toTrimmedString(sshRaw.user),
    password: toTrimmedString(sshRaw.password),
    keyPath: toTrimmedString(sshRaw.keyPath),
    knownHostsPath: toTrimmedString(sshRaw.knownHostsPath),
    hostKeyFingerprint: toTrimmedString(sshRaw.hostKeyFingerprint),
  };
  const proxyRaw =
    raw.proxy && typeof raw.proxy === "object"
      ? (raw.proxy as Record<string, unknown>)
      : {};
  const proxyTypeRaw = toTrimmedString(proxyRaw.type, "socks5").toLowerCase();
  const proxyType: "socks5" | "http" =
    proxyTypeRaw === "http" ? "http" : "socks5";
  const proxy = {
    type: proxyType,
    host: toTrimmedString(proxyRaw.host),
    port: normalizePort(proxyRaw.port, proxyTypeRaw === "http" ? 8080 : 1080),
    user: toTrimmedString(proxyRaw.user),
    password: toTrimmedString(proxyRaw.password),
  };
  const httpTunnelRaw =
    raw.httpTunnel && typeof raw.httpTunnel === "object"
      ? (raw.httpTunnel as Record<string, unknown>)
      : raw.HTTPTunnel && typeof raw.HTTPTunnel === "object"
        ? (raw.HTTPTunnel as Record<string, unknown>)
        : {};
  const httpTunnel = {
    host: toTrimmedString(httpTunnelRaw.host ?? raw.httpTunnelHost),
    port: normalizePort(httpTunnelRaw.port ?? raw.httpTunnelPort, 8080),
    user: toTrimmedString(httpTunnelRaw.user ?? raw.httpTunnelUser),
    password: toTrimmedString(httpTunnelRaw.password ?? raw.httpTunnelPassword),
    encodeBase64:
      (httpTunnelRaw.encodeBase64 ?? raw.httpTunnelEncodeBase64) !== false,
  };
  const normalizedProtection = normalizeConnectionProtectionConfig(
    raw.protection,
  );

  const safeConfig: ConnectionConfig & Record<string, unknown> = {
    ...raw,
    id: toTrimmedString(raw.id ?? raw.ID),
    type,
    host: toTrimmedString(raw.host, "localhost") || "localhost",
    port: normalizePort(raw.port, defaultPort),
    user: toTrimmedString(raw.user),
    password: savePassword ? toTrimmedString(raw.password) : "",
    savePassword,
    database: toTrimmedString(raw.database),
    readOnly: raw.readOnly === true,
    protection: normalizedProtection,
    useSSH: !!raw.useSSH,
    ssh,
    useProxy: !!raw.useProxy,
    proxy,
    useHttpTunnel: !!raw.useHttpTunnel,
    httpTunnel,
    uri: toTrimmedString(raw.uri).slice(0, MAX_URI_LENGTH),
    connectionParams: toTrimmedString(raw.connectionParams).slice(
      0,
      MAX_URI_LENGTH,
    ),
    hosts: sanitizeAddressList(raw.hosts),
    timeout: normalizeIntegerInRange(
      raw.timeout,
      DEFAULT_TIMEOUT_SECONDS,
      1,
      MAX_TIMEOUT_SECONDS,
    ),
  };

  const resolvedProtection = resolveConnectionProtectionConfig(safeConfig);
  safeConfig.protection = resolvedProtection;
  safeConfig.readOnly = deriveLegacyConnectionReadOnlyFlag(resolvedProtection);

  if (type === "jvm") {
    safeConfig.jvm = sanitizeJVMConfig(raw.jvm, {
      host: safeConfig.host,
      port: safeConfig.port,
      timeout: safeConfig.timeout || DEFAULT_TIMEOUT_SECONDS,
      persistSecrets: savePassword,
    });
  }

  return safeConfig;
};

const resolveConnectionConfigPayload = (
  raw: Record<string, unknown>,
): unknown => {
  if (raw.config && typeof raw.config === "object") {
    return raw.config;
  }
  // 兼容历史/导入场景：连接对象可能是扁平结构（无 config 包装）。
  const hasLegacyFlatConfig =
    raw.type !== undefined ||
    raw.host !== undefined ||
    raw.port !== undefined ||
    raw.user !== undefined ||
    raw.database !== undefined;
  if (hasLegacyFlatConfig) {
    return raw;
  }
  return undefined;
};

const sanitizeSavedConnection = (
  value: unknown,
  index: number,
): SavedConnection | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const config = sanitizeConnectionConfig(resolveConnectionConfigPayload(raw));
  const id =
    toTrimmedString(raw.id, `conn-${index + 1}`) || `conn-${index + 1}`;
  const fallbackName = config.host
    ? `${config.type}-${config.host}`
    : `conn-${index + 1}`;
  const name = toTrimmedString(raw.name, fallbackName) || fallbackName;
  const createdAtValue = Number(raw.createdAt);

  return {
    id,
    name,
    createdAt: Number.isFinite(createdAtValue) && createdAtValue > 0 ? createdAtValue : undefined,
    config: { ...config, id: config.id || id },
    secretRef: toTrimmedString(raw.secretRef) || undefined,
    hasPrimaryPassword: raw.hasPrimaryPassword === true,
    hasSSHPassword: raw.hasSSHPassword === true,
    hasProxyPassword: raw.hasProxyPassword === true,
    hasHttpTunnelPassword: raw.hasHttpTunnelPassword === true,
    hasOpaqueURI: raw.hasOpaqueURI === true,
    hasOpaqueDSN: raw.hasOpaqueDSN === true,
    iconType: sanitizeConnectionIconType(raw.iconType),
    iconColor: sanitizeConnectionIconColor(raw.iconColor),
  };
};

const sanitizeConnections = (value: unknown): SavedConnection[] => {
  if (!Array.isArray(value)) return [];
  const result: SavedConnection[] = [];
  const idSet = new Set<string>();

  value.forEach((entry, index) => {
    const conn = sanitizeSavedConnection(entry, index);
    if (!conn) return;
    let nextId = conn.id;
    if (idSet.has(nextId)) {
      nextId = `${nextId}-${index + 1}`;
    }
    idSet.add(nextId);
    result.push({ ...conn, id: nextId });
  });

  return result;
};

/** 允许持久化的页签类型：设置中心、服务详情与 JVM 诊断页签。 */
const WORKBENCH_TAB_TYPES: readonly TabData["type"][] = [
  "settings-center",
  "service-detail",
  "jvm-overview",
  "jvm-resource",
  "jvm-audit",
  "jvm-diagnostic",
  "jvm-monitoring",
];

const sanitizeTabs = (value: unknown): TabData[] => {
  const entries = Array.isArray(value) ? value : [];
  const result: TabData[] = [];
  const seenIds = new Set<string>();

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const raw = entry as Record<string, unknown>;
    const rawType = toTrimmedString(raw.type);
    if (!(WORKBENCH_TAB_TYPES as readonly string[]).includes(rawType)) return;

    let id = toTrimmedString(raw.id, `tab-${index + 1}`) || `tab-${index + 1}`;
    if (seenIds.has(id)) {
      id = `${id}-${index + 1}`;
    }
    seenIds.add(id);

    result.push({
      id,
      title: toTrimmedString(raw.title, rawType) || rawType,
      type: rawType as TabData["type"],
      connectionId: toTrimmedString(raw.connectionId),
      serviceName: toTrimmedString(raw.serviceName) || undefined,
      readOnly: raw.readOnly === true,
      providerMode: raw.providerMode as TabData["providerMode"],
      resourcePath: toTrimmedString(raw.resourcePath) || undefined,
      resourceKind: toTrimmedString(raw.resourceKind) || undefined,
    });
  });

  return result;
};

const sanitizeActiveTabId = (activeTabId: unknown, tabs: TabData[]): string | null => {
  const id = toTrimmedString(activeTabId);
  if (id && tabs.some((tab) => tab.id === id)) {
    return id;
  }
  return tabs[0]?.id || null;
};

const resolveCloseTabActiveTabId = (
  newTabs: TabData[],
): string | null => (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);

export interface SqlLog {
  id: string;
  timestamp: number;
  sql: string;
  status: "success" | "error";
  duration: number;
  hiddenFromRecent?: boolean;
  message?: string;
  dbName?: string;
  affectedRows?: number;
  category?: "query" | "transaction";
  transactionId?: string;
  transactionAction?: "commit" | "rollback";
}

type SqlLogSanitizeOptions = {
  limit: number;
  sqlLength: number;
  messageLength: number;
};

const RUNTIME_SQL_LOG_SANITIZE_OPTIONS: SqlLogSanitizeOptions = {
  limit: MAX_RUNTIME_SQL_LOGS,
  sqlLength: MAX_RUNTIME_SQL_LOG_LENGTH,
  messageLength: MAX_RUNTIME_SQL_LOG_MESSAGE_LENGTH,
};

const PERSISTED_SQL_LOG_SANITIZE_OPTIONS: SqlLogSanitizeOptions = {
  limit: MAX_PERSISTED_SQL_LOGS,
  sqlLength: MAX_PERSISTED_SQL_LOG_LENGTH,
  messageLength: MAX_PERSISTED_SQL_LOG_MESSAGE_LENGTH,
};

const sanitizeSqlLogEntry = (
  entry: unknown,
  index: number,
  options: SqlLogSanitizeOptions,
): SqlLog | null => {
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Record<string, unknown>;
  const sql = typeof raw.sql === "string" ? raw.sql.slice(0, options.sqlLength) : "";
  if (!sql.trim()) return null;

  const status = raw.status === "error" ? "error" : "success";
  const timestamp = Number(raw.timestamp);
  const duration = Number(raw.duration);
  const affectedRows = Number(raw.affectedRows);
  const message = typeof raw.message === "string"
    ? raw.message.slice(0, options.messageLength)
    : "";

  const log: SqlLog = {
    id: toTrimmedString(raw.id, `log-${index + 1}`) || `log-${index + 1}`,
    timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
    sql,
    status,
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    dbName: toTrimmedString(raw.dbName) || undefined,
  };

  if (raw.category === "query" || raw.category === "transaction") {
    log.category = raw.category;
  }
  const transactionId = toTrimmedString(raw.transactionId);
  if (transactionId) {
    log.transactionId = transactionId;
  }
  if (raw.transactionAction === "commit" || raw.transactionAction === "rollback") {
    log.transactionAction = raw.transactionAction;
  }

  if (message) {
    log.message = message;
  }
  if (raw.hiddenFromRecent === true) {
    log.hiddenFromRecent = true;
  }
  if (Number.isFinite(affectedRows)) {
    log.affectedRows = affectedRows;
  }

  return log;
};

const sanitizeSqlLogs = (
  value: unknown,
  options: SqlLogSanitizeOptions = PERSISTED_SQL_LOG_SANITIZE_OPTIONS,
): SqlLog[] => {
  if (!Array.isArray(value)) return [];
  const result: SqlLog[] = [];
  const seenIds = new Set<string>();

  value.forEach((entry, index) => {
    const log = sanitizeSqlLogEntry(entry, index, options);
    if (!log) return;

    let id = log.id;
    if (seenIds.has(id)) {
      id = `${id}-${index + 1}`;
    }
    seenIds.add(id);

    result.push(id === log.id ? log : { ...log, id });
  });

  return result.slice(0, options.limit);
};

const sanitizeRuntimeSqlLogs = (value: unknown) =>
  sanitizeSqlLogs(value, RUNTIME_SQL_LOG_SANITIZE_OPTIONS);

const sanitizePersistedSqlLogs = (value: unknown) =>
  sanitizeSqlLogs(value, PERSISTED_SQL_LOG_SANITIZE_OPTIONS);

const appendRuntimeSqlLog = (existing: SqlLog[], entry: SqlLog): SqlLog[] => {
  const nextEntry = sanitizeSqlLogEntry(entry, 0, RUNTIME_SQL_LOG_SANITIZE_OPTIONS);
  if (!nextEntry) {
    return existing;
  }

  const nextLogs = [nextEntry, ...existing.slice(0, MAX_RUNTIME_SQL_LOGS - 1)];
  return existing.some((item) => item.id === nextEntry.id)
    ? sanitizeRuntimeSqlLogs(nextLogs)
    : nextLogs;
};

const sanitizeTheme = (value: unknown): ThemeMode =>
  value === "dark" ? "dark" : "light";

const sanitizeThemePreference = (
  value: unknown,
  fallbackTheme: ThemeMode = "light",
): ThemePreference => (value === "system" ? "system" : sanitizeTheme(value ?? fallbackTheme));

const sanitizeLanguagePreference = (value: unknown): LanguagePreference => {
  if (
    typeof value === "string" &&
    (LANGUAGE_PREFERENCES as readonly string[]).includes(value)
  ) {
    return value as LanguagePreference;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const resolved = resolveLanguage(value, []);
    if (resolved !== DEFAULT_LANGUAGE) {
      return resolved;
    }
  }
  return DEFAULT_LANGUAGE_PREFERENCE;
};

const sanitizeV2SidebarRailScale = (value: unknown): number => {
  return normalizeFloatInRange(
    value,
    DEFAULT_V2_SIDEBAR_RAIL_SCALE,
    MIN_V2_SIDEBAR_RAIL_SCALE,
    MAX_V2_SIDEBAR_RAIL_SCALE,
  );
};

const sanitizeTabEnvironmentAccentThickness = (value: unknown): number => {
  return normalizeIntegerInRange(
    value,
    DEFAULT_TAB_ENVIRONMENT_ACCENT_THICKNESS,
    MIN_TAB_ENVIRONMENT_ACCENT_THICKNESS,
    MAX_TAB_ENVIRONMENT_ACCENT_THICKNESS,
  );
};

const isLegacyDefaultAppearance = (value: Partial<AppearanceSettings> | undefined): boolean => {
  if (!value || typeof value !== "object") return false;
  const KEYS = ["opacity", "blur", "uiScale", "fontSize"] as const;
  const DEFAULTS: Record<string, number> = {
    opacity: 1,
    blur: 0,
    uiScale: 1,
    fontSize: 14,
  };
  return KEYS.every((key) => {
    const raw = (value as Record<string, unknown>)[key];
    return raw === undefined || raw === DEFAULTS[key];
  });
};

const sanitizeAppearance = (
  appearance: Partial<AppearanceSettings> | undefined,
  version: number,
): AppearanceSettings => {
  if (!appearance || typeof appearance !== "object") {
    return { ...DEFAULT_APPEARANCE };
  }
  const dataGridDisplaySettings = sanitizeDataGridDisplaySettings(appearance);
  const sqlEditorTypographySettings = version < SQL_EDITOR_FONT_SIZE_SPLIT_VERSION
    ? migrateLegacySqlEditorTypographySettings(dataGridDisplaySettings)
    : sanitizeSqlEditorTypographySettings(appearance);
  const nextAppearance: AppearanceSettings = {
    enabled:
      typeof appearance.enabled === "boolean"
        ? appearance.enabled
        : DEFAULT_APPEARANCE.enabled,
    opacity:
      typeof appearance.opacity === "number"
        ? appearance.opacity
        : DEFAULT_APPEARANCE.opacity,
    blur:
      typeof appearance.blur === "number"
        ? appearance.blur
        : DEFAULT_APPEARANCE.blur,
    v2SidebarRailScale: sanitizeV2SidebarRailScale(
      appearance.v2SidebarRailScale,
    ),
    tabEnvironmentAccentThickness: sanitizeTabEnvironmentAccentThickness(
      appearance.tabEnvironmentAccentThickness,
    ),
    toolbarButtonColorOverrides: sanitizeToolbarButtonColorOverrides(
      appearance.toolbarButtonColorOverrides,
    ),
    customUIFontFamily: sanitizeFontFamilyInput(appearance.customUIFontFamily),
    customMonoFontFamily: sanitizeFontFamilyInput(appearance.customMonoFontFamily),
    tabDisplay: version < TAB_DISPLAY_DEFAULT_MIGRATION_VERSION
      ? sanitizeTabDisplaySettings(DEFAULT_TAB_DISPLAY_SETTINGS)
      : sanitizeTabDisplaySettings(appearance.tabDisplay),
    showDataTableVerticalBorders:
      dataGridDisplaySettings.showDataTableVerticalBorders,
    showDataTableRowNumber: dataGridDisplaySettings.showDataTableRowNumber,
    dataTableDensity: dataGridDisplaySettings.dataTableDensity,
    dataTableFontSize: dataGridDisplaySettings.dataTableFontSize,
    dataTableFontSizeFollowGlobal:
      dataGridDisplaySettings.dataTableFontSizeFollowGlobal,
    sqlEditorFontSize: sqlEditorTypographySettings.sqlEditorFontSize,
    sqlEditorFontSizeFollowGlobal:
      sqlEditorTypographySettings.sqlEditorFontSizeFollowGlobal,
    sidebarTreeFontSize: dataGridDisplaySettings.sidebarTreeFontSize,
    sidebarTreeFontSizeFollowGlobal:
      dataGridDisplaySettings.sidebarTreeFontSizeFollowGlobal,
  };
  if (version < 2 && isLegacyDefaultAppearance(appearance)) {
    return { ...DEFAULT_APPEARANCE };
  }
  return nextAppearance;
};

const sanitizeStartupFullscreen = (value: unknown): boolean => {
  return value === true;
};

const sanitizeAutoCheckForUpdates = (value: unknown): boolean => {
  return typeof value === "boolean" ? value : DEFAULT_AUTO_CHECK_FOR_UPDATES;
};

const sanitizeAutoCheckForUpdatesIntervalMinutes = (
  value: unknown,
): number => {
  const minutes = Math.round(Number(value));
  if (
    Number.isFinite(minutes) &&
    AUTO_CHECK_FOR_UPDATES_INTERVAL_OPTIONS_SET.has(minutes)
  ) {
    return minutes;
  }
  return DEFAULT_AUTO_CHECK_FOR_UPDATES_INTERVAL_MINUTES;
};

const sanitizeUiScale = (value: unknown): number => {
  return normalizeFloatInRange(
    value,
    DEFAULT_UI_SCALE,
    MIN_UI_SCALE,
    MAX_UI_SCALE,
  );
};

const sanitizeFontSize = (value: unknown): number => {
  return normalizeIntegerInRange(
    value,
    DEFAULT_FONT_SIZE,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
  );
};

const sanitizeWindowState = (
  value: unknown,
): "normal" | "fullscreen" | "maximized" => {
  if (value === "fullscreen" || value === "maximized") return value;
  return "normal";
};

const sanitizeWindowBounds = (
  value: unknown,
): { width: number; height: number; x: number; y: number; dpi?: number } | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const width = Number(raw.width);
  const height = Number(raw.height);
  const x = Number(raw.x);
  const y = Number(raw.y);
  const dpi = Number(raw.dpi);
  if (![width, height, x, y].every(Number.isFinite) || width < 400 || height < 300) return null;
  return {
    width: Math.trunc(width),
    height: Math.trunc(height),
    x: Math.trunc(x),
    y: Math.trunc(y),
    ...(Number.isFinite(dpi) && dpi > 0 ? { dpi: Math.trunc(dpi) } : {}),
  };
};

const unwrapPersistedAppState = (
  persistedState: unknown,
): Record<string, unknown> => {
  if (!persistedState || typeof persistedState !== "object") {
    return {};
  }
  const raw = persistedState as Record<string, unknown>;
  if (raw.state && typeof raw.state === "object") {
    return raw.state as Record<string, unknown>;
  }
  return raw;
};

let shortcutOptionsExplicitlySet = false;

const sanitizePersistedShortcutOptions = (
  value: unknown,
  version: number,
): ShortcutOptions => (
  version < SIDEBAR_SEARCH_SHORTCUT_MIGRATION_VERSION
    ? migrateLegacySidebarSearchShortcutOptions(value)
    : sanitizeShortcutOptions(value)
);

const readPersistedShortcutOptions = (): ShortcutOptions | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const payload = localStorage.getItem(PERSIST_STORAGE_KEY);
    if (!payload) {
      return null;
    }
    const raw = JSON.parse(payload) as Record<string, unknown>;
    const state = unwrapPersistedAppState(raw);
    if (state.shortcutOptions === undefined) {
      return null;
    }
    const version = typeof raw.version === "number" ? raw.version : 0;
    return sanitizePersistedShortcutOptions(state.shortcutOptions, version);
  } catch {
    return null;
  }
};

const resolveShortcutOptionsForPersistence = (
  shortcutOptions: ShortcutOptions,
): ShortcutOptions => {
  const safeOptions = sanitizeShortcutOptions(shortcutOptions);
  if (shortcutOptionsExplicitlySet) {
    return safeOptions;
  }
  return readPersistedShortcutOptions() ?? safeOptions;
};

const runWithExplicitShortcutPersistence = (callback: () => void): void => {
  shortcutOptionsExplicitlySet = true;
  try {
    callback();
  } finally {
    shortcutOptionsExplicitlySet = false;
  }
};

interface AppState {
  connections: SavedConnection[];
  tabs: TabData[];
  /** 主工作区已拆出的浮动窗口（会话态，不持久化） */
  detachedWorkbenchWindows: DetachedWorkbenchWindow[];
  activeTabId: string | null;
  theme: ThemeMode;
  themePreference: ThemePreference;
  /** Built-in brand mascot icon id (01-10), used in title bar / about / favicon. */
  brandIconId: string;
  languagePreference: LanguagePreference;
  appearance: AppearanceSettings;
  uiScale: number;
  fontSize: number;
  /** Legacy persisted name; true means maximise the startup window on every desktop platform. */
  startupFullscreen: boolean;
  /** 启动后与定时静默检查更新；默认开启 */
  autoCheckForUpdates: boolean;
  /** 自动检查更新间隔（分钟），默认 30 */
  autoCheckForUpdatesIntervalMinutes: number;
  shortcutOptions: ShortcutOptions;
  sqlLogs: SqlLog[];
  windowBounds: { width: number; height: number; x: number; y: number; dpi?: number } | null;
  windowState: "normal" | "fullscreen" | "maximized";
  sidebarWidth: number;

  jvmDiagnosticDrafts: Record<string, JVMDiagnosticCommandDraft>;
  jvmDiagnosticOutputs: Record<string, JVMDiagnosticEventChunk[]>;
  setJVMDiagnosticDraft: (
    tabId: string,
    draft: Partial<JVMDiagnosticCommandDraft>,
  ) => void;
  appendJVMDiagnosticOutput: (
    tabId: string,
    chunks: JVMDiagnosticEventChunk[],
  ) => void;
  clearJVMDiagnosticOutput: (tabId: string) => void;

  replaceConnections: (connections: SavedConnection[]) => void;

  addTab: (tab: TabData) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  moveTab: (sourceId: string, targetId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  detachWorkbenchTab: (
    tabId: string,
    preferred?: Partial<Pick<DetachedWindowBounds, "x" | "y" | "width" | "height">>,
  ) => void;
  attachWorkbenchTab: (tabId: string) => void;
  updateDetachedWorkbenchBounds: (
    tabId: string,
    bounds: Partial<Pick<DetachedWindowBounds, "x" | "y" | "width" | "height">>,
  ) => void;
  focusDetachedWorkbenchTab: (tabId: string) => void;
  isWorkbenchTabDetached: (tabId: string) => boolean;

  setTheme: (theme: ThemeMode) => void;
  setThemePreference: (themePreference: ThemePreference) => void;
  setLanguagePreference: (languagePreference: LanguagePreference) => void;
  setAppearance: (appearance: Partial<AppearanceSettings>) => void;
  setUiScale: (scale: number) => void;
  setFontSize: (size: number) => void;
  setStartupFullscreen: (enabled: boolean) => void;
  setAutoCheckForUpdates: (enabled: boolean) => void;
  setAutoCheckForUpdatesIntervalMinutes: (minutes: number) => void;
  updateShortcut: (
    action: ShortcutAction,
    binding: Partial<ShortcutPlatformBinding>,
    platform?: ShortcutPlatform,
  ) => void;
  resetShortcutOptions: () => void;

  addSqlLog: (log: SqlLog) => void;
  clearSqlLogs: () => void;
  setWindowBounds: (bounds: {
    width: number;
    height: number;
    x: number;
    y: number;
    dpi?: number;
  }) => void;
  setWindowState: (state: "normal" | "fullscreen" | "maximized") => void;
  setSidebarWidth: (width: number) => void;
}

const PERSISTED_STATE_DEPENDENCY_KEYS = [
  "tabs",
  "activeTabId",
  "theme",
  "themePreference",
  "brandIconId",
  "languagePreference",
  "appearance",
  "uiScale",
  "fontSize",
  "startupFullscreen",
  "autoCheckForUpdates",
  "autoCheckForUpdatesIntervalMinutes",
  "shortcutOptions",
  "sqlLogs",
  "windowBounds",
  "windowState",
  "sidebarWidth",
  "connections",
] as const satisfies readonly (keyof AppState)[];

type PersistedStateProjectionSource = Pick<
  AppState,
  (typeof PERSISTED_STATE_DEPENDENCY_KEYS)[number]
>;

const buildPersistedStateProjection = (
  state: PersistedStateProjectionSource,
): AppState => {
  const tabs = sanitizeTabs(state.tabs);
  const partialState: Partial<AppState> = {
    tabs,
    activeTabId: sanitizeActiveTabId(state.activeTabId, tabs),
    theme: state.theme,
    themePreference: state.themePreference,
    brandIconId: sanitizeBrandIconIdLocal(state.brandIconId),
    languagePreference: state.languagePreference,
    appearance: state.appearance,
    uiScale: state.uiScale,
    fontSize: state.fontSize,
    startupFullscreen: state.startupFullscreen,
    autoCheckForUpdates: state.autoCheckForUpdates,
    autoCheckForUpdatesIntervalMinutes:
      state.autoCheckForUpdatesIntervalMinutes,
    shortcutOptions: resolveShortcutOptionsForPersistence(state.shortcutOptions),
    sqlLogs: sanitizePersistedSqlLogs(state.sqlLogs),
    windowBounds: state.windowBounds,
    windowState: state.windowState,
    sidebarWidth: state.sidebarWidth,
  };

  if (state.connections.length > 0) {
    partialState.connections = state.connections;
  }

  return partialState as AppState;
};

const createMemoizedPersistedStateProjection = () => {
  let previousDependencies: unknown[] | null = null;
  let previousProjection: AppState | null = null;

  return (state: AppState): AppState => {
    if (previousDependencies && previousProjection) {
      let changedDependencyIndex = -1;
      for (
        let index = 0;
        index < PERSISTED_STATE_DEPENDENCY_KEYS.length;
        index += 1
      ) {
        const key = PERSISTED_STATE_DEPENDENCY_KEYS[index];
        if (!Object.is(previousDependencies[index], state[key])) {
          if (changedDependencyIndex !== -1) {
            changedDependencyIndex = -2;
            break;
          }
          changedDependencyIndex = index;
        }
      }
      if (changedDependencyIndex === -1) {
        return previousProjection;
      }
      if (
        changedDependencyIndex >= 0
        && PERSISTED_STATE_DEPENDENCY_KEYS[changedDependencyIndex] === "activeTabId"
      ) {
        // Tab switches keep the tab payload unchanged.
        previousDependencies[changedDependencyIndex] = state.activeTabId;
        previousProjection = {
          ...previousProjection,
          activeTabId: sanitizeActiveTabId(
            state.activeTabId,
            previousProjection.tabs,
          ),
        };
        return previousProjection;
      }
    }

    previousDependencies = PERSISTED_STATE_DEPENDENCY_KEYS.map(
      (key) => state[key],
    );
    previousProjection = buildPersistedStateProjection(state);
    return previousProjection;
  };
};

const partializePersistedState = createMemoizedPersistedStateProjection();

const appPersistStorage = createDebouncedPersistStorage<AppState>(
  () => localStorage,
  {
    debounceMs: PERSIST_WRITE_DEBOUNCE_MS,
    enabled: !isFrontendTestRuntime(),
  },
);

export const flushAppStatePersistence = async (): Promise<void> => {
  const flush = (appPersistStorage as { flush?: () => Promise<void> } | undefined)?.flush;
  if (typeof flush === "function") {
    await flush();
  }
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      connections: [],
      tabs: [],
      detachedWorkbenchWindows: [],
      activeTabId: null,
      theme: "light",
      themePreference: "light",
      brandIconId: DEFAULT_BRAND_ICON_ID,
      languagePreference: DEFAULT_LANGUAGE_PREFERENCE,
      appearance: { ...DEFAULT_APPEARANCE },
      uiScale: DEFAULT_UI_SCALE,
      fontSize: DEFAULT_FONT_SIZE,
      startupFullscreen: DEFAULT_STARTUP_FULLSCREEN,
      autoCheckForUpdates: DEFAULT_AUTO_CHECK_FOR_UPDATES,
      autoCheckForUpdatesIntervalMinutes:
        DEFAULT_AUTO_CHECK_FOR_UPDATES_INTERVAL_MINUTES,
      shortcutOptions: cloneShortcutOptions(DEFAULT_SHORTCUT_OPTIONS),
      sqlLogs: [],
      windowBounds: null,
      windowState: "normal" as const,
      sidebarWidth: 330,

      jvmDiagnosticDrafts: {},
      jvmDiagnosticOutputs: {},

      replaceConnections: (connections) =>
        set((state) => ({
          connections: sanitizeConnections(connections),
          shortcutOptions:
            readPersistedShortcutOptions() ?? state.shortcutOptions,
        })),

      addTab: (tab) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === tab.id);
          if (index !== -1) {
            // Update existing tab with new data (e.g. switch target service).
            const newTabs = [...state.tabs];
            newTabs[index] = { ...newTabs[index], ...tab };
            return {
              tabs: newTabs,
              activeTabId: tab.id,
            };
          }
          return {
            tabs: [...state.tabs, tab],
            activeTabId: tab.id,
          };
        }),

      closeTab: (id) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== id);
          let newActiveId = state.activeTabId;
          if (state.activeTabId === id) {
            // Prefer next docked tab when closing the active one
            const dockedCandidates = newTabs.filter(
              (tab) =>
                !state.detachedWorkbenchWindows.some(
                  (windowState) => windowState.tabId === tab.id,
                ),
            );
            newActiveId =
              resolveCloseTabActiveTabId(dockedCandidates) ||
              resolveCloseTabActiveTabId(newTabs);
          }
          return {
            tabs: newTabs,
            activeTabId: newActiveId,
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.filter(
              (windowState) => windowState.tabId !== id,
            ),
          };
        }),

      closeOtherTabs: (id) =>
        set((state) => {
          const keep = state.tabs.find((t) => t.id === id);
          if (!keep) return state;
          const newTabs = state.tabs.filter((tab) => tab.id === id);
          const keptIds = new Set(newTabs.map((tab) => tab.id));
          return {
            tabs: newTabs,
            activeTabId: id,
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.filter(
              (windowState) => keptIds.has(windowState.tabId),
            ),
          };
        }),

      closeTabsToLeft: (id) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === id);
          if (index === -1) return state;
          const newTabs = state.tabs.filter(
            (_tab, tabIndex) => tabIndex >= index,
          );
          const keptIds = new Set(newTabs.map((tab) => tab.id));
          const activeStillExists = state.activeTabId
            ? newTabs.some((t) => t.id === state.activeTabId)
            : false;
          return {
            tabs: newTabs,
            activeTabId: activeStillExists ? state.activeTabId : id,
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.filter(
              (windowState) => keptIds.has(windowState.tabId),
            ),
          };
        }),

      closeTabsToRight: (id) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === id);
          if (index === -1) return state;
          const newTabs = state.tabs.filter(
            (_tab, tabIndex) => tabIndex <= index,
          );
          const keptIds = new Set(newTabs.map((tab) => tab.id));
          const activeStillExists = state.activeTabId
            ? newTabs.some((t) => t.id === state.activeTabId)
            : false;
          return {
            tabs: newTabs,
            activeTabId: activeStillExists ? state.activeTabId : id,
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.filter(
              (windowState) => keptIds.has(windowState.tabId),
            ),
          };
        }),

      moveTab: (sourceId, targetId) =>
        set((state) => {
          const fromId = String(sourceId || "").trim();
          const toId = String(targetId || "").trim();
          if (!fromId || !toId || fromId === toId) {
            return state;
          }
          const fromIndex = state.tabs.findIndex((tab) => tab.id === fromId);
          const toIndex = state.tabs.findIndex((tab) => tab.id === toId);
          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
            return state;
          }
          const nextTabs = [...state.tabs];
          const [movingTab] = nextTabs.splice(fromIndex, 1);
          nextTabs.splice(toIndex, 0, movingTab);
          return { tabs: nextTabs };
        }),

      closeAllTabs: () =>
        set((state) => ({
          tabs: [],
          activeTabId: null,
          detachedWorkbenchWindows: [],
        })),

      setActiveTab: (id) =>
        set((state) => {
          const tabId = String(id || "").trim();
          const isDetached = state.detachedWorkbenchWindows.some(
            (windowState) => windowState.tabId === tabId,
          );
          if (!isDetached) {
            return { activeTabId: tabId };
          }
          // Detached tab: keep docked state, raise floating window
          const zIndex = nextDetachedZIndex(state.detachedWorkbenchWindows);
          return {
            activeTabId: tabId,
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.map(
              (windowState) =>
                windowState.tabId === tabId
                  ? { ...windowState, zIndex }
                  : windowState,
            ),
          };
        }),

      detachWorkbenchTab: (tabId, preferred) =>
        set((state) => {
          const id = String(tabId || "").trim();
          if (!id || !state.tabs.some((tab) => tab.id === id)) {
            return state;
          }
          const existing = state.detachedWorkbenchWindows.find(
            (windowState) => windowState.tabId === id,
          );
          if (existing) {
            const zIndex = nextDetachedZIndex(state.detachedWorkbenchWindows);
            return {
              activeTabId: id,
              detachedWorkbenchWindows: state.detachedWorkbenchWindows.map(
                (windowState) =>
                  windowState.tabId === id
                    ? { ...windowState, zIndex }
                    : windowState,
              ),
            };
          }
          const bounds = createDefaultDetachedBounds(
            state.detachedWorkbenchWindows,
            preferred,
          );
          return {
            detachedWorkbenchWindows: [
              ...state.detachedWorkbenchWindows,
              { tabId: id, ...bounds },
            ],
            // Keep detached tab active so focus stays correct;
            // TabManager only renders docked tabs and falls back visually.
            activeTabId: id,
          };
        }),

      attachWorkbenchTab: (tabId) =>
        set((state) => {
          const id = String(tabId || "").trim();
          if (!id) return state;
          if (
            !state.detachedWorkbenchWindows.some(
              (windowState) => windowState.tabId === id,
            )
          ) {
            return { activeTabId: id };
          }
          return {
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.filter(
              (windowState) => windowState.tabId !== id,
            ),
            activeTabId: id,
          };
        }),

      updateDetachedWorkbenchBounds: (tabId, bounds) =>
        set((state) => {
          const id = String(tabId || "").trim();
          if (!id) return state;
          return {
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.map(
              (windowState) =>
                windowState.tabId === id
                  ? {
                      ...windowState,
                      ...(bounds.x !== undefined ? { x: bounds.x } : {}),
                      ...(bounds.y !== undefined ? { y: bounds.y } : {}),
                      ...(bounds.width !== undefined
                        ? { width: bounds.width }
                        : {}),
                      ...(bounds.height !== undefined
                        ? { height: bounds.height }
                        : {}),
                    }
                  : windowState,
            ),
          };
        }),

      focusDetachedWorkbenchTab: (tabId) =>
        set((state) => {
          const id = String(tabId || "").trim();
          if (
            !id ||
            !state.detachedWorkbenchWindows.some(
              (windowState) => windowState.tabId === id,
            )
          ) {
            return state;
          }
          const zIndex = nextDetachedZIndex(state.detachedWorkbenchWindows);
          return {
            activeTabId: id,
            detachedWorkbenchWindows: state.detachedWorkbenchWindows.map(
              (windowState) =>
                windowState.tabId === id
                  ? { ...windowState, zIndex }
                  : windowState,
            ),
          };
        }),

      isWorkbenchTabDetached: (tabId) =>
        get().detachedWorkbenchWindows.some(
          (windowState) => windowState.tabId === String(tabId || "").trim(),
        ),

      setTheme: (theme) => set({ theme }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setLanguagePreference: (languagePreference) =>
        set({ languagePreference }),
      setAppearance: (appearance) =>
        set((state) => ({
          appearance: sanitizeAppearance(
            { ...state.appearance, ...appearance },
            PERSIST_VERSION,
          ),
        })),
      setUiScale: (scale) => set({ uiScale: sanitizeUiScale(scale) }),
      setFontSize: (size) => set({ fontSize: sanitizeFontSize(size) }),
      setStartupFullscreen: (enabled) =>
        set({ startupFullscreen: sanitizeStartupFullscreen(enabled) }),
      setAutoCheckForUpdates: (enabled) =>
        set({ autoCheckForUpdates: sanitizeAutoCheckForUpdates(enabled) }),
      setAutoCheckForUpdatesIntervalMinutes: (minutes) =>
        set({
          autoCheckForUpdatesIntervalMinutes:
            sanitizeAutoCheckForUpdatesIntervalMinutes(minutes),
        }),

      updateShortcut: (action, binding, platform) => {
        runWithExplicitShortcutPersistence(() => {
          const targetPlatform = platform ?? getShortcutPlatform();
          set((state) => ({
            shortcutOptions: {
              ...state.shortcutOptions,
              [action]: {
                ...state.shortcutOptions[action],
                [targetPlatform]: {
                  ...state.shortcutOptions[action][targetPlatform],
                  ...binding,
                },
              },
            },
          }));
        });
      },

      resetShortcutOptions: () =>
        runWithExplicitShortcutPersistence(() =>
          set({ shortcutOptions: cloneShortcutOptions(DEFAULT_SHORTCUT_OPTIONS) }),
        ),

      addSqlLog: (log) =>
        set((state) => ({ sqlLogs: appendRuntimeSqlLog(state.sqlLogs, log) })),
      clearSqlLogs: () => set({ sqlLogs: [] }),

      setWindowBounds: (bounds) => {
        const dpi = bounds.dpi;
        const nextBounds = {
          width: Math.max(400, Math.trunc(bounds.width)),
          height: Math.max(300, Math.trunc(bounds.height)),
          x: Math.trunc(bounds.x),
          y: Math.trunc(bounds.y),
          ...(typeof dpi === "number" && Number.isFinite(dpi) && dpi > 0
            ? { dpi: Math.trunc(dpi) }
            : {}),
        };
        set({ windowBounds: nextBounds });
        // 与 startupFullscreen 一致：立即落盘，避免 Windows 退出时异步 persist 丢尺寸记忆
        writePersistedStatePatch({ windowBounds: nextBounds });
      },

      setWindowState: (state) => {
        const nextState = sanitizeWindowState(state);
        set({ windowState: nextState });
        // 与窗口尺寸一致即时落盘，避免退出阶段丢失最后一次观测状态。
        writePersistedStatePatch({ windowState: nextState });
      },

      setSidebarWidth: (width) =>
        set({ sidebarWidth: sanitizeSidebarWidth(width) }),

      setJVMDiagnosticDraft: (tabId, draft) =>
        set((state) => ({
          jvmDiagnosticDrafts: {
            ...state.jvmDiagnosticDrafts,
            [tabId]: {
              command:
                draft.command ??
                state.jvmDiagnosticDrafts[tabId]?.command ??
                "",
              sessionId:
                draft.sessionId ?? state.jvmDiagnosticDrafts[tabId]?.sessionId,
              source: draft.source ?? state.jvmDiagnosticDrafts[tabId]?.source,
              reason: draft.reason ?? state.jvmDiagnosticDrafts[tabId]?.reason,
            },
          },
        })),
      appendJVMDiagnosticOutput: (tabId, chunks) =>
        set((state) => ({
          jvmDiagnosticOutputs: {
            ...state.jvmDiagnosticOutputs,
            [tabId]: [
              ...(state.jvmDiagnosticOutputs[tabId] || []),
              ...chunks,
            ],
          },
        })),
      clearJVMDiagnosticOutput: (tabId) =>
        set((state) => ({
          jvmDiagnosticOutputs: {
            ...state.jvmDiagnosticOutputs,
            [tabId]: [],
          },
        })),
    }),
    {
      name: PERSIST_STORAGE_KEY, // name of the item in the storage (must be unique)
      storage: appPersistStorage,
      skipHydration: isNativeDetachedWindowRoute(),
      version: PERSIST_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        const state = unwrapPersistedAppState(
          persistedState,
        ) as Partial<AppState>;
        const nextState: Partial<AppState> = {};
        // 缺失连接表示由启动阶段从后端加载，迁移时不能把它写成空数组。
        if (state.connections !== undefined) {
          nextState.connections = sanitizeConnections(state.connections);
        }
        const safeTabs = sanitizeTabs(state.tabs);
        nextState.tabs = safeTabs;
        nextState.activeTabId = sanitizeActiveTabId(state.activeTabId, safeTabs);
        nextState.theme = sanitizeTheme(state.theme);
        nextState.themePreference = sanitizeThemePreference(
          state.themePreference,
          nextState.theme,
        );
        nextState.brandIconId = sanitizeBrandIconIdLocal(state.brandIconId);
        nextState.languagePreference = sanitizeLanguagePreference(
          state.languagePreference,
        );
        nextState.appearance = sanitizeAppearance(state.appearance, version);
        nextState.uiScale = sanitizeUiScale(state.uiScale);
        nextState.fontSize = sanitizeFontSize(state.fontSize);
        nextState.startupFullscreen = sanitizeStartupFullscreen(
          state.startupFullscreen,
        );
        nextState.autoCheckForUpdates = sanitizeAutoCheckForUpdates(
          state.autoCheckForUpdates,
        );
        nextState.autoCheckForUpdatesIntervalMinutes =
          sanitizeAutoCheckForUpdatesIntervalMinutes(
            state.autoCheckForUpdatesIntervalMinutes,
          );
        nextState.shortcutOptions = sanitizePersistedShortcutOptions(
          state.shortcutOptions,
          version,
        );
        nextState.sqlLogs = sanitizeRuntimeSqlLogs(state.sqlLogs);
        nextState.windowBounds = sanitizeWindowBounds(state.windowBounds);
        nextState.windowState = sanitizeWindowState(state.windowState);
        nextState.sidebarWidth = sanitizeSidebarWidth(state.sidebarWidth);
        return nextState as AppState;
      },
      merge: (persistedState, currentState) => {
        const state = unwrapPersistedAppState(
          persistedState,
        ) as Partial<AppState>;
        const safeTabs = sanitizeTabs(state.tabs);
        const persistedConnections =
          state.connections === undefined
            ? currentState.connections
            : sanitizeConnections(state.connections);
        return {
          ...currentState,
          connections: persistedConnections,
          tabs: safeTabs,
          // Floating windows are session-only and must not be restored from disk.
          detachedWorkbenchWindows: [],
          activeTabId: sanitizeActiveTabId(state.activeTabId, safeTabs),
          theme: sanitizeTheme(state.theme),
          themePreference: sanitizeThemePreference(
            state.themePreference,
            sanitizeTheme(state.theme),
          ),
          brandIconId: sanitizeBrandIconIdLocal(state.brandIconId),
          languagePreference: sanitizeLanguagePreference(
            state.languagePreference,
          ),
          appearance: sanitizeAppearance(state.appearance, PERSIST_VERSION),
          uiScale: sanitizeUiScale(state.uiScale),
          fontSize: sanitizeFontSize(state.fontSize),
          startupFullscreen: sanitizeStartupFullscreen(state.startupFullscreen),
          autoCheckForUpdates: sanitizeAutoCheckForUpdates(
            state.autoCheckForUpdates,
          ),
          autoCheckForUpdatesIntervalMinutes:
            sanitizeAutoCheckForUpdatesIntervalMinutes(
              state.autoCheckForUpdatesIntervalMinutes,
            ),
          shortcutOptions: sanitizeShortcutOptions(state.shortcutOptions),
          sqlLogs: sanitizeRuntimeSqlLogs(state.sqlLogs),
          windowBounds: sanitizeWindowBounds(state.windowBounds),
          windowState: sanitizeWindowState(state.windowState),
          sidebarWidth: sanitizeSidebarWidth(state.sidebarWidth),
        };
      },
      partialize: partializePersistedState,
    },
  ),
);
