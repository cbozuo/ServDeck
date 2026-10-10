import type { ConnectionConfig } from "../types";

export type ConnectionProtectionKey =
  | "restrictDataEdit"
  | "restrictStructureEdit"
  | "restrictScriptExecution"
  | "restrictDataImport";

export type ConnectionProtectionConfig = NonNullable<
  ConnectionConfig["protection"]
>;

type ConnectionReadOnlyLike = Pick<
  ConnectionConfig,
  "type" | "driver" | "readOnly" | "protection"
> | null | undefined;

export const CONNECTION_PROTECTION_KEYS: ConnectionProtectionKey[] = [
  "restrictDataEdit",
  "restrictStructureEdit",
  "restrictScriptExecution",
  "restrictDataImport",
];

const EMPTY_CONNECTION_PROTECTION: ConnectionProtectionConfig = {
  restrictDataEdit: false,
  restrictStructureEdit: false,
  restrictScriptExecution: false,
  restrictDataImport: false,
};

const FULL_CONNECTION_PROTECTION: ConnectionProtectionConfig = {
  restrictDataEdit: true,
  restrictStructureEdit: true,
  restrictScriptExecution: true,
  restrictDataImport: true,
};

/** 只读保护模式保留用于历史持久化数据的兼容解析；
 *  ServDeck 服务（JVM）连接本身不进入 SQL 只读判定。 */
const CONNECTION_PROTECTION_TYPES = new Set([
  "mysql",
  "goldendb",
  "mariadb",
  "oceanbase",
  "diros",
  "starrocks",
  "sphinx",
  "postgres",
  "kingbase",
  "highgo",
  "vastbase",
  "opengauss",
  "gaussdb",
  "sqlserver",
  "iris",
  "cache",
  "sqlite",
  "duckdb",
  "nacos",
]);

const resolveConnectionReadOnlyType = (
  config: ConnectionReadOnlyLike,
): string => {
  if (!config) return "";
  return String(config.type || "").trim().toLowerCase();
};

export const supportsConnectionReadOnlyMode = (
  config: ConnectionReadOnlyLike,
): boolean => {
  return CONNECTION_PROTECTION_TYPES.has(resolveConnectionReadOnlyType(config));
};

export const normalizeConnectionProtectionConfig = (
  value: unknown,
): ConnectionProtectionConfig => {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    restrictDataEdit: raw.restrictDataEdit === true,
    restrictStructureEdit: raw.restrictStructureEdit === true,
    restrictScriptExecution: raw.restrictScriptExecution === true,
    restrictDataImport: raw.restrictDataImport === true,
  };
};

export const createEmptyConnectionProtectionConfig =
  (): ConnectionProtectionConfig => ({ ...EMPTY_CONNECTION_PROTECTION });

export const deriveLegacyConnectionReadOnlyFlag = (
  protection: unknown,
): boolean => {
  const normalized = normalizeConnectionProtectionConfig(protection);
  return CONNECTION_PROTECTION_KEYS.every((key) => normalized[key] === true);
};

export const resolveConnectionProtectionConfig = (
  config: ConnectionReadOnlyLike,
): ConnectionProtectionConfig => {
  if (!supportsConnectionReadOnlyMode(config)) {
    return createEmptyConnectionProtectionConfig();
  }
  const normalized = normalizeConnectionProtectionConfig(config?.protection);
  const hasExplicitRestriction = CONNECTION_PROTECTION_KEYS.some(
    (key) => normalized[key] === true,
  );
  if (hasExplicitRestriction) {
    return normalized;
  }
  if (config?.readOnly === true) {
    return { ...FULL_CONNECTION_PROTECTION };
  }
  return createEmptyConnectionProtectionConfig();
};

export const isConnectionProtectionEnabled = (
  config: ConnectionReadOnlyLike,
  key: ConnectionProtectionKey,
): boolean => {
  return resolveConnectionProtectionConfig(config)[key] === true;
};
