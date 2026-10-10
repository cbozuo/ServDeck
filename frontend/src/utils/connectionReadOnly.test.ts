import { describe, expect, it } from 'vitest';
import {
  CONNECTION_PROTECTION_KEYS,
  createEmptyConnectionProtectionConfig,
  deriveLegacyConnectionReadOnlyFlag,
  isConnectionProtectionEnabled,
  normalizeConnectionProtectionConfig,
  resolveConnectionProtectionConfig,
  supportsConnectionReadOnlyMode,
} from './connectionReadOnly';

describe('connection protection config compat', () => {
  it('normalizes unknown payloads into explicit boolean flags', () => {
    expect(normalizeConnectionProtectionConfig(undefined)).toEqual({
      restrictDataEdit: false,
      restrictStructureEdit: false,
      restrictScriptExecution: false,
      restrictDataImport: false,
    });
    expect(normalizeConnectionProtectionConfig({
      restrictDataEdit: true,
      restrictScriptExecution: 'yes',
    })).toEqual({
      restrictDataEdit: true,
      restrictStructureEdit: false,
      restrictScriptExecution: false,
      restrictDataImport: false,
    });
  });

  it('derives the legacy read-only flag from full protection', () => {
    expect(deriveLegacyConnectionReadOnlyFlag(undefined)).toBe(false);
    expect(deriveLegacyConnectionReadOnlyFlag({
      restrictDataEdit: true,
      restrictStructureEdit: true,
      restrictScriptExecution: true,
      restrictDataImport: true,
    })).toBe(true);
    expect(deriveLegacyConnectionReadOnlyFlag({
      restrictDataEdit: true,
      restrictStructureEdit: false,
      restrictScriptExecution: true,
      restrictDataImport: true,
    })).toBe(false);
  });

  it('keeps empty protection for non-SQL service connections', () => {
    const jvmConfig = { type: 'jvm', readOnly: true } as const;
    expect(supportsConnectionReadOnlyMode(jvmConfig)).toBe(false);
    expect(resolveConnectionProtectionConfig(jvmConfig)).toEqual(
      createEmptyConnectionProtectionConfig(),
    );
    expect(isConnectionProtectionEnabled(jvmConfig, 'restrictDataEdit')).toBe(false);
  });

  it('resolves explicit restrictions and legacy read-only on SQL connections', () => {
    const sqlConfig = { type: 'postgres' } as const;
    expect(supportsConnectionReadOnlyMode(sqlConfig)).toBe(true);
    expect(resolveConnectionProtectionConfig(sqlConfig)).toEqual(
      createEmptyConnectionProtectionConfig(),
    );
    expect(resolveConnectionProtectionConfig({
      type: 'postgres',
      readOnly: true,
    })).toEqual({
      restrictDataEdit: true,
      restrictStructureEdit: true,
      restrictScriptExecution: true,
      restrictDataImport: true,
    });
    expect(resolveConnectionProtectionConfig({
      type: 'mysql',
      protection: { restrictDataEdit: true },
    })).toEqual({
      restrictDataEdit: true,
      restrictStructureEdit: false,
      restrictScriptExecution: false,
      restrictDataImport: false,
    });
  });

  it('exposes the canonical protection key order', () => {
    expect(CONNECTION_PROTECTION_KEYS).toEqual([
      'restrictDataEdit',
      'restrictStructureEdit',
      'restrictScriptExecution',
      'restrictDataImport',
    ]);
  });
});
