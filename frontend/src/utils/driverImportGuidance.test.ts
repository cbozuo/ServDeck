import { describe, expect, it } from 'vitest';

import { t } from '../i18n';
import {
  getCustomConnectionDriverHelp,
  getDriverLocalImportButtonLabel,
  getDriverLocalImportDirectoryHelp,
  getDriverLocalImportSingleFileHelp,
} from './driverImportGuidance';

describe('driver import guidance', () => {
  it('exposes only functional guidance APIs to avoid freezing the current language', async () => {
    const guidance = await import('./driverImportGuidance');

    expect(guidance).not.toHaveProperty('DRIVER_LOCAL_IMPORT_BUTTON_LABEL');
    expect(guidance).not.toHaveProperty('DRIVER_LOCAL_IMPORT_DIRECTORY_HELP');
    expect(guidance).not.toHaveProperty('DRIVER_LOCAL_IMPORT_SINGLE_FILE_HELP');
    expect(guidance).not.toHaveProperty('CUSTOM_CONNECTION_DRIVER_HELP');
  });

  it.each(['zh-CN', 'en-US'] as const)('reuses driver_manager action label for local import button in %s', (language) => {
    expect(getDriverLocalImportButtonLabel(language)).toBe(t('driver_manager.action.import_package', undefined, language));
  });

  it.each(['zh-CN', 'en-US'] as const)('keeps driver_manager import guidance helpers in %s', (language) => {
    expect(getDriverLocalImportDirectoryHelp(language)).toBe(t('driver_manager.import.directory_help', undefined, language));
    expect(getDriverLocalImportSingleFileHelp(language)).toBe(t('driver_manager.import.single_file_help', undefined, language));
    expect(getDriverLocalImportSingleFileHelp(language)).toContain('JDBC Jar');
  });

  it.each(['zh-CN', 'en-US'] as const)('documents custom driver aliases for kingbase and related fallbacks in %s', (language) => {
    const helpText = getCustomConnectionDriverHelp(language);

    expect(helpText).toContain('kingbase8');
    expect(helpText).toContain('pgx');
    expect(helpText).toContain('open_gauss');
    expect(helpText).toContain('oceanbase');
    expect(helpText).toContain('clickhouse');
    expect(helpText).toContain('jdbc:clickhouse://');
    expect(helpText).toContain('Go database/sql');
    expect(helpText).toContain('ODBC/JDBC');
    expect(helpText).toContain('JDBC Jar');
  });
});
