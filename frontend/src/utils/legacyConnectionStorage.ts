import { SavedConnection } from '../types';

export const LEGACY_PERSIST_KEY = 'lite-db-storage';

const toTrimmedString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
};

const normalizeProxyType = (value: unknown): 'socks5' | 'http' => {
  return toTrimmedString(value).toLowerCase() === 'http' ? 'http' : 'socks5';
};

const normalizePort = (value: unknown, fallbackPort: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackPort;
  }
  const port = Math.trunc(parsed);
  if (port <= 0 || port > 65535) {
    return fallbackPort;
  }
  return port;
};

const parsePersistedEnvelope = (payload: string | null | undefined): Record<string, unknown> => {
  if (!payload || typeof payload !== 'string') {
    return {};
  }
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (parsed.state && typeof parsed.state === 'object') {
      return parsed.state as Record<string, unknown>;
    }
    return parsed;
  } catch {
    return {};
  }
};

export function readLegacyPersistedSecrets(payload: string | null | undefined): {
  connections: SavedConnection[];
} {
  const state = parsePersistedEnvelope(payload);
  const connections = Array.isArray(state.connections)
    ? state.connections.filter((item): item is SavedConnection => !!item && typeof item === 'object')
    : [];

  return { connections };
}

export function hasLegacyMigratableSensitiveItems(payload: string | null | undefined): boolean {
  const legacy = readLegacyPersistedSecrets(payload);
  return legacy.connections.length > 0;
}

export function stripLegacyPersistedSecrets(payload: string | null | undefined): string {
  if (!payload || typeof payload !== 'string') {
    return '';
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return payload;
  }

  const state = parsed.state && typeof parsed.state === 'object'
    ? parsed.state as Record<string, unknown>
    : parsed;
  state.connections = [];

  if (state.globalProxy !== undefined) {
    delete state.globalProxy;
  }

  return JSON.stringify(parsed);
}

export function stripLegacyPersistedConnectionById(
  payload: string | null | undefined,
  connectionId: string,
): string {
  if (!payload || typeof payload !== 'string') {
    return '';
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return payload;
  }

  const state = parsed.state && typeof parsed.state === 'object'
    ? parsed.state as Record<string, unknown>
    : parsed;
  const targetId = toTrimmedString(connectionId);
  if (!targetId || !Array.isArray(state.connections)) {
    return payload;
  }

  state.connections = state.connections.filter((item) => {
    if (!item || typeof item !== 'object') {
      return true;
    }
    return toTrimmedString((item as { id?: unknown }).id) !== targetId;
  });

  return JSON.stringify(parsed);
}
