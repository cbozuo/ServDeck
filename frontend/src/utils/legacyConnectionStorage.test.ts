import { describe, expect, it } from 'vitest';

import {
  hasLegacyMigratableSensitiveItems,
  readLegacyPersistedSecrets,
  stripLegacyPersistedConnectionById,
  stripLegacyPersistedSecrets,
} from './legacyConnectionStorage';

describe('legacy connection storage', () => {
  it('extracts legacy saved connections from lite-db-storage', () => {
    const payload = JSON.stringify({
      state: {
        connections: [
          {
            id: 'conn-1',
            name: 'Primary',
            config: {
              id: 'conn-1',
              type: 'postgres',
              host: 'db.local',
              port: 5432,
              user: 'postgres',
              password: 'secret',
            },
          },
        ],
      },
    });

    const result = readLegacyPersistedSecrets(payload);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]?.config.password).toBe('secret');
  });

  it('clears legacy connection source data after cleanup', () => {
    const payload = JSON.stringify({
      state: {
        connections: [
          {
            id: 'conn-1',
            name: 'Primary',
            config: {
              id: 'conn-1',
              type: 'postgres',
              host: 'db.local',
              port: 5432,
              user: 'postgres',
              password: 'secret',
            },
          },
        ],
      },
    });

    const sanitized = stripLegacyPersistedSecrets(payload);
    const parsed = JSON.parse(sanitized);

    expect(parsed.state.connections).toEqual([]);
  });

  it('detects migratable sensitive items before cleanup and clears the signal after cleanup', () => {
    const payload = JSON.stringify({
      state: {
        connections: [
          {
            id: 'conn-1',
            name: 'Primary',
            config: {
              id: 'conn-1',
              type: 'postgres',
              host: 'db.local',
              port: 5432,
              user: 'postgres',
              password: 'secret',
            },
          },
        ],
      },
    });

    expect(hasLegacyMigratableSensitiveItems(payload)).toBe(true);
    expect(hasLegacyMigratableSensitiveItems(stripLegacyPersistedSecrets(payload))).toBe(false);
  });

  it('removes only the repaired legacy connection while preserving other source data', () => {
    const payload = JSON.stringify({
      state: {
        connections: [
          {
            id: 'conn-1',
            name: 'Primary',
            config: {
              id: 'conn-1',
              type: 'postgres',
              host: 'db.local',
              port: 5432,
              user: 'postgres',
              password: 'secret',
            },
          },
          {
            id: 'conn-2',
            name: 'Replica',
            config: {
              id: 'conn-2',
              type: 'mysql',
              host: 'replica.local',
              port: 3306,
              user: 'root',
              password: 'replica-secret',
            },
          },
        ],
      },
    });

    const sanitized = stripLegacyPersistedConnectionById(payload, 'conn-1');
    const parsed = JSON.parse(sanitized);

    expect(parsed.state.connections).toEqual([
      expect.objectContaining({
        id: 'conn-2',
        config: expect.objectContaining({
          password: 'replica-secret',
        }),
      }),
    ]);
  });
});
