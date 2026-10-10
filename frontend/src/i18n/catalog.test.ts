import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { catalogs, getCatalogKeys, t } from "./catalog";
import { SUPPORTED_LANGUAGES } from "./resolveLanguage";

const getPlaceholders = (value: string): string[] =>
  Array.from(value.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g), (match) => match[1]).sort();

const readDataGridSource = (): string =>
  readFileSync(new URL("../components/DataGrid.tsx", import.meta.url), "utf8");

const readDataGridColumnInfoPopoverContentSource = (): string =>
  readFileSync(new URL("../components/DataGridColumnInfoPopoverContent.tsx", import.meta.url), "utf8");

const readDataGridColumnQuickFindSource = (): string =>
  readFileSync(new URL("../components/DataGridColumnQuickFind.tsx", import.meta.url), "utf8");

const readDataGridColumnTitleSource = (): string =>
  readFileSync(new URL("../components/DataGridColumnTitle.tsx", import.meta.url), "utf8");

const readDataGridModalsSource = (): string =>
  readFileSync(new URL("../components/DataGridModals.tsx", import.meta.url), "utf8");

const readDataGridPageFindSource = (): string =>
  readFileSync(new URL("../components/DataGridPageFind.tsx", import.meta.url), "utf8");

const readDataGridPaginationBarSource = (): string =>
  readFileSync(new URL("../components/DataGridPaginationBar.tsx", import.meta.url), "utf8");

const readDataGridPaginationSource = (): string =>
  readFileSync(new URL("../utils/dataGridPagination.ts", import.meta.url), "utf8");

const readDataGridPreviewPanelSource = (): string =>
  readFileSync(new URL("../components/DataGridPreviewPanel.tsx", import.meta.url), "utf8");

const readDataGridRecordViewsSource = (): string =>
  readFileSync(new URL("../components/DataGridRecordViews.tsx", import.meta.url), "utf8");

const readDataGridResultViewSwitcherSource = (): string =>
  readFileSync(new URL("../components/DataGridResultViewSwitcher.tsx", import.meta.url), "utf8");

const readDataGridSecondaryActionsSource = (): string =>
  readFileSync(new URL("../components/DataGridSecondaryActions.tsx", import.meta.url), "utf8");

const readDataGridV2DdlWorkspaceSource = (): string =>
  readFileSync(new URL("../components/DataGridV2DdlWorkspace.tsx", import.meta.url), "utf8");

const readQueryEditorSource = (): string =>
  readFileSync(new URL("../components/QueryEditor.tsx", import.meta.url), "utf8");

const readAppSource = (): string =>
  readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

const readQueryEditorHelpersSource = (): string =>
  readFileSync(new URL("../components/queryEditor/QueryEditorHelpers.ts", import.meta.url), "utf8");

const readQueryEditorResultsPanelSource = (): string =>
  readFileSync(new URL("../components/QueryEditorResultsPanel.tsx", import.meta.url), "utf8");

const readSqlDialectSource = (): string =>
  readFileSync(new URL("../utils/sqlDialect.ts", import.meta.url), "utf8");

const readRowLocatorSource = (): string =>
  readFileSync(new URL("../utils/rowLocator.ts", import.meta.url), "utf8");

const sliceBetween = (source: string, start: string, end: string): string => {
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const startIndex = normalizedSource.indexOf(start);
  const endIndex = normalizedSource.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return normalizedSource.slice(startIndex, endIndex);
};

// 切片起点用「函数名 + 参数开头」的正则锚定，而不是写死完整签名：
// handleRun 一类函数的参数会随功能演进增删（如新增 runOptions），
// 写死签名会让 indexOf 静默返回 -1、切片落到错误区间，断言随之失效。
const sliceFromFunctionStart = (source: string, declaration: string, end: string): string => {
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const pattern = new RegExp(`^\\s*(?:const|function)\\s+${declaration}\\b[^\\n]*\\{`, "m");
  const match = pattern.exec(normalizedSource);

  expect(match).not.toBeNull();
  const startIndex = match!.index;
  const endIndex = normalizedSource.indexOf(end, startIndex + match![0].length);

  expect(endIndex).toBeGreaterThan(startIndex);

  return normalizedSource.slice(startIndex, endIndex);
};

const assertSourceDoesNotInlineCatalogValues = (
  source: string,
  keys: readonly (keyof (typeof catalogs)["en-US"] )[],
  options?: {
    ignoreEnglishBaseline?: boolean;
  },
): void => {
  const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const language of SUPPORTED_LANGUAGES) {
    for (const key of keys) {
      const value = catalogs[language][key];
      expect(value).toBeTruthy();
      if (!value) {
        continue;
      }
      if (options?.ignoreEnglishBaseline && value === catalogs["en-US"][key]) {
        continue;
      }
      if (executableSource.includes(value)) {
        throw new Error(`catalog literal leaked into source: ${language} ${key}`);
      }
    }
  }
};

describe("i18n catalog", () => {

  it("loads six complete catalogs with consistent base keys", () => {
    const baseKeys = getCatalogKeys("en-US");

    expect(SUPPORTED_LANGUAGES).toHaveLength(6);
    expect(baseKeys).toContain("common.cancel");
    expect(baseKeys).toContain("settings.language.title");

    for (const language of SUPPORTED_LANGUAGES) {
      expect(getCatalogKeys(language)).toEqual(baseKeys);
      expect(catalogs[language]["common.cancel"]).toBeTruthy();
      expect(catalogs[language]["settings.language.title"]).toBeTruthy();
    }
  });

  it("keeps MSI and Portable update copy complete across all catalogs", () => {
    const updateKeys = [
      "app.about.action.download_msi_update",
      "app.about.action.download_portable_update",
      "app.about.action.install_and_restart",
      "app.about.action.launch_installer",
      "app.about.download_progress.ready_to_install",
      "app.about.download_progress.installing_and_restarting",
      "app.about.download_progress.launching_installer",
      "app.about.download_progress.restarting_after_install",
      "app.about.download_progress.installer_started",
      "app.about.message.download_ready_install",
      "app.about.message.download_ready_install_with_path",
      "app.about.update_status.new_version_ready_install",
      "app.about.version.install_mode",
      "app.about.version.package_type",
      "app.about.install_mode.portable",
      "app.about.install_mode.msi",
      "app.about.package_type.portable",
      "app.about.package_type.msi",
    ] as const;
    const base = catalogs["en-US"];

    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of updateKeys) {
        expect(catalogs[language]).toHaveProperty(key);
        expect(catalogs[language][key]).toBeTruthy();
        expect(getPlaceholders(catalogs[language][key])).toEqual(getPlaceholders(base[key]));
      }
    }
  });

  it("keeps latest and dev update channel descriptions distinct", () => {
    const latestHintKey = "app.about.version_update.channel_hint.latest";
    const devHintKey = "app.about.version_update.channel_hint.dev";

    for (const language of SUPPORTED_LANGUAGES) {
      expect(catalogs[language]).toHaveProperty(latestHintKey);
      expect(catalogs[language]).toHaveProperty(devHintKey);
      expect(catalogs[language][latestHintKey]).toBeTruthy();
      expect(catalogs[language][devHintKey]).toBeTruthy();
      expect(catalogs[language][latestHintKey]).not.toBe(catalogs[language][devHintKey]);
    }

    expect(catalogs["zh-CN"][latestHintKey]).toBe("接收最新的稳定版本");
    expect(catalogs["zh-CN"][devHintKey]).toBe("接收最新的开发版本");
  });

  it("keeps data-root log directory copy complete across all catalogs", () => {
    const logDirectoryKeys = [
      "app.data_root.log_directory.backend.dialog.select_directory",
      "app.data_root.log_directory.backend.error.desktop_only",
      "app.data_root.log_directory.backend.error.directory_unavailable",
      "app.data_root.log_directory.backend.error.environment_managed",
      "app.data_root.log_directory.backend.error.open_directory_failed",
      "app.data_root.log_directory.backend.error.open_directory_unsupported",
      "app.data_root.log_directory.backend.error.save_failed",
      "app.data_root.log_directory.backend.message.opened",
      "app.data_root.log_directory.backend.message.unchanged",
      "app.data_root.log_directory.backend.message.updated_restart",
      "app.data_root.log_directory.current_file",
      "app.data_root.log_directory.default_directory",
      "app.data_root.log_directory.description",
      "app.data_root.log_directory.environment_hint",
      "app.data_root.log_directory.message.apply_failed_with_error",
      "app.data_root.log_directory.message.open_failed_with_error",
      "app.data_root.log_directory.message.select_failed_with_error",
      "app.data_root.log_directory.message.select_valid_first",
      "app.data_root.log_directory.message.updated",
      "app.data_root.log_directory.pending_restart",
      "app.data_root.log_directory.placeholder",
      "app.data_root.log_directory.restart_hint",
      "app.data_root.log_directory.title",
    ] as const;
    const base = catalogs["en-US"];

    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of logDirectoryKeys) {
        expect(catalogs[language]).toHaveProperty(key);
        expect(catalogs[language][key]).toBeTruthy();
        expect(getPlaceholders(catalogs[language][key])).toEqual(getPlaceholders(base[key]));
      }
    }

    expect(catalogs["zh-CN"]["app.data_root.log_directory.title"]).toBe("日志目录");
    expect(catalogs["zh-CN"]["app.data_root.log_directory.environment_hint"]).toContain("GONAVI_LOG_DIR");
    expect(catalogs["en-US"]["app.data_root.log_directory.restart_hint"]).toContain("gonavi.log");
  });

  it("includes App shell keys required by every supported language", () => {
    const appShellKeys = [
      "app.tools.title",
      "app.tools.group.workflow.title",
      "app.tools.group.workflow.description",
      "app.data_root.title",
      "app.data_root.action.switch_only",
      "app.data_root.message.apply_failed",
      "app.data_root.message.apply_failed_with_error",
      "app.data_root.message.load_failed",
      "app.data_root.message.load_failed_with_error",
      "app.data_root.message.open_failed",
      "app.data_root.message.open_failed_with_error",
      "app.data_root.message.select_failed",
      "app.data_root.message.select_failed_with_error",
      "app.data_root.message.select_valid_first",
      "app.data_root.message.updated",
      "app.sidebar.collapse",
      "app.sidebar.expand",
      "app.sidebar.resize_width",
      "app.sidebar.settings",
      "app.sidebar.sql_execution_log",
      "app.sidebar.tools",
      "app.window_zoom.message.fullscreen_exit_first",
      "app.window_zoom.message.reset_failed",
      "app.window_zoom.message.reset_success",
      "app.window_zoom.message.reset_success_fallback",
      "app.window_zoom.message.windows_only",
      "app.about.title",
      "app.about.field.update_status",
      "common.back_to_previous",
      "common.unknown",
      "common.close",
    ] as const;

    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of appShellKeys) {
        expect(catalogs[language]).toHaveProperty(key);
        expect(catalogs[language][key]).toBeTruthy();
      }
    }
  });

  it("includes App theme modal shell keys required by every supported language", () => {
    const themeModalShellKeys = [
      "app.theme.appearance_settings_description",
      "app.theme.appearance_settings_title",
      "app.theme.mode.dark.description",
      "app.theme.mode.dark.label",
      "app.theme.mode.light.description",
      "app.theme.mode.light.label",
      "app.theme.mode.system.description",
      "app.theme.mode.system.label",
      "app.theme.mode_title",
      "app.theme.data_table.row_number",
      "app.theme.data_table.row_number_hint",
      "app.theme.data_table.table_double_click_action",
      "app.theme.data_table.table_double_click_action.open_data",
      "app.theme.data_table.table_double_click_action.open_design",
      "app.theme.data_table.table_double_click_action_hint",
      "app.theme.data_table.query_ctrl_click_action",
      "app.theme.data_table.query_ctrl_click_action.open_design",
      "app.theme.data_table.query_ctrl_click_action.locate",
      "app.theme.data_table.query_ctrl_click_action_hint",
      "app.theme.instant_apply_hint",
      "app.theme.nav.appearance.description",
      "app.theme.nav.appearance.title",
      "app.theme.nav.theme.description",
      "app.theme.nav.theme.title",
      "app.theme.navigation_title",
      "app.theme.theme_settings_description",
      "app.theme.theme_settings_title",
    ] as const;

    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of themeModalShellKeys) {
        expect(catalogs[language]).toHaveProperty(key);
        expect(catalogs[language][key]).toBeTruthy();
      }
    }
  });

  it("includes App shortcut modal keys required by every supported language", () => {
    const shortcutModalKeys = [
      "app.shortcuts.action.closeActiveTab.description",
      "app.shortcuts.action.closeActiveTab.label",
      "app.shortcuts.action.focusSidebarSearch.description",
      "app.shortcuts.action.focusSidebarSearch.label",
      "app.shortcuts.action.newConnection.description",
      "app.shortcuts.action.newConnection.label",
      "app.shortcuts.action.newQueryTab.description",
      "app.shortcuts.action.newQueryTab.label",
      "app.shortcuts.action.openShortcutManager.description",
      "app.shortcuts.action.openShortcutManager.label",
      "app.shortcuts.action.record",
      "app.shortcuts.action.duplicateCurrentLine.description",
      "app.shortcuts.action.duplicateCurrentLine.label",
      "app.shortcuts.action.resetWindowZoom.description",
      "app.shortcuts.action.resetWindowZoom.label",
      "app.shortcuts.action.restore_defaults",
      "app.shortcuts.action.runQuery.description",
      "app.shortcuts.action.runQuery.label",
      "app.shortcuts.action.saveQuery.description",
      "app.shortcuts.action.saveQuery.label",
      "app.shortcuts.action.saveQueryAs.description",
      "app.shortcuts.action.saveQueryAs.label",
      "app.shortcuts.action.selectCurrentStatement.description",
      "app.shortcuts.action.selectCurrentStatement.label",
      "app.shortcuts.action.switchToNextTab.description",
      "app.shortcuts.action.switchToNextTab.label",
      "app.shortcuts.action.switchToPreviousTab.description",
      "app.shortcuts.action.switchToPreviousTab.label",
      "app.shortcuts.action.toggleLogPanel.description",
      "app.shortcuts.action.toggleLogPanel.label",
      "app.shortcuts.action.toggleMacFullscreen.description",
      "app.shortcuts.action.toggleMacFullscreen.label",
      "app.shortcuts.action.toggleTheme.description",
      "app.shortcuts.action.toggleTheme.label",
      "app.shortcuts.capture_hint",
      "app.shortcuts.capture_waiting",
      "app.shortcuts.context.datagrid",
      "app.shortcuts.context.global",
      "app.shortcuts.context.monaco",
      "app.shortcuts.description",
      "app.shortcuts.message.ai_send_limit",
      "app.shortcuts.message.conflict",
      "app.shortcuts.message.modifier_required",
      "app.shortcuts.message.reserved_conflict_info",
      "app.shortcuts.message.reserved_conflict_warning",
      "app.shortcuts.message.restored_defaults",
      "app.shortcuts.reserved.browser_close_tab",
      "app.shortcuts.reserved.browser_new_incognito_window",
      "app.shortcuts.reserved.browser_new_tab",
      "app.shortcuts.reserved.browser_new_window",
      "app.shortcuts.reserved.browser_print",
      "app.shortcuts.reserved.browser_save",
      "app.shortcuts.reserved.datagrid_copy",
      "app.shortcuts.reserved.editor_add_selection",
      "app.shortcuts.reserved.editor_delete_line",
      "app.shortcuts.reserved.editor_find",
      "app.shortcuts.reserved.editor_find_global",
      "app.shortcuts.reserved.editor_goto_line",
      "app.shortcuts.reserved.editor_insert_line_after",
      "app.shortcuts.reserved.editor_insert_line_before",
      "app.shortcuts.reserved.editor_quick_open",
      "app.shortcuts.reserved.editor_rename_symbol",
      "app.shortcuts.reserved.editor_replace",
      "app.shortcuts.title",
      "common.cancel",
      "common.close",
    ] as const;

    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of shortcutModalKeys) {
        expect(catalogs[language]).toHaveProperty(key);
        expect(catalogs[language][key]).toBeTruthy();
      }
    }

    expect(t("en-US", "app.shortcuts.message.conflict", { action: "Run SQL" })).toContain("Run SQL");
    expect(t("en-US", "app.shortcuts.message.reserved_conflict_warning", {
      contexts: "Browser",
      labels: "Browser Save",
    })).toContain("Browser Save");
  });

  it("keeps placeholders aligned and preserves raw parameter values", () => {
    const base = catalogs["en-US"];
    const key = "connection_modal.title.create";

    for (const language of SUPPORTED_LANGUAGES) {
      expect(getPlaceholders(catalogs[language][key])).toEqual(
        getPlaceholders(base[key]),
      );
    }

    expect(t("en-US", key, { type: "<raw>" })).toBe("New <raw> connection");
  });

  it("keeps raw cancelled sentinels out of data-root and export feedback catalogs", () => {
    const guardedKeyPrefixes = [
      "app.data_root.",
      "data_export.",
    ];

    for (const language of SUPPORTED_LANGUAGES) {
      for (const [key, value] of Object.entries(catalogs[language])) {
        if (guardedKeyPrefixes.some((prefix) => key.startsWith(prefix))) {
          expect(value, `${language}:${key}`).not.toBe("已取消");
        }
      }
    }
  });

  it("keeps DataGrid commit, preview SQL, and copy feedback messages in catalogs with raw placeholders", () => {
    const detailKeys = [
      "data_grid.message.change_set_build_failed_detail",
      "data_grid.message.preview_sql_failed_detail",
      "data_grid.message.commit_failed",
      "data_grid.message.commit_outcome_unknown",
      "data_grid.message.auto_commit_outcome_unknown",
      "data_grid.message.rollback_failed",
    ];
    const noPlaceholderKeys = [
      "data_grid.message.change_set_build_failed",
      "data_grid.message.preview_sql_failed",
      "data_grid.message.transaction_committed",
      "data_grid.message.transaction_rolled_back",
      "data_grid.message.no_changes_to_commit",
      "data_grid.message.copied_to_clipboard",
      "data_grid.message.no_field_name",
      "data_grid.message.no_copyable_columns",
      "data_grid.message.no_copyable_cells",
      "data_grid.message.drag_select_cells_to_copy",
      "data_grid.message.selection_no_copyable_content",
      "data_grid.message.copy_sql_not_supported",
      "data_grid.message.keep_one_visible_column",
      "data_grid.message.result_set_no_copyable_content",
      "data_grid.message.current_row_no_copyable_content",
      "data_grid.copy_sql.error.missing_safe_where",
      "data_grid.copy_sql.error.no_copyable_fields",
    ];
    const modeKeys = [
      "data_grid.copy_sql.error.missing_table_name",
    ];
    const allKeys = [...detailKeys, ...noPlaceholderKeys, ...modeKeys];
    const base = catalogs["en-US"] as Record<string, string>;

    for (const language of SUPPORTED_LANGUAGES) {
      const catalog = catalogs[language] as Record<string, string>;
      for (const key of allKeys) {
        expect(catalog).toHaveProperty(key);
        expect(catalog[key]).toBeTruthy();
        expect(getPlaceholders(catalog[key])).toEqual(getPlaceholders(base[key]));
      }

      detailKeys.forEach((key) => {
        expect(getPlaceholders(catalog[key])).toEqual(["detail"]);
      });
      noPlaceholderKeys.forEach((key) => {
        expect(getPlaceholders(catalog[key])).toEqual([]);
      });
      modeKeys.forEach((key) => {
        expect(getPlaceholders(catalog[key])).toEqual(["mode"]);
      });
    }

    expect(t("en-US", "data_grid.message.commit_failed", { detail: "<raw-detail>" })).toContain("<raw-detail>");
    expect(t("en-US", "data_grid.message.rollback_failed", { detail: "<raw-rollback-detail>" })).toContain("<raw-rollback-detail>");
    expect(t("zh-CN", "data_grid.message.preview_sql_failed_detail", { detail: "<raw-preview-error>" })).toContain("<raw-preview-error>");
    expect(t("de-DE", "data_grid.copy_sql.error.missing_table_name", { mode: "UPDATE" })).toContain("UPDATE");
  });

  it("keeps DataGrid Preview SQL Modal chrome in catalogs while preserving raw SQL operation labels", () => {
    const noPlaceholderKeys = [
      "data_grid.preview_sql.title",
      "data_grid.preview_sql.copied",
      "data_grid.preview_sql.no_changes",
    ];
    const summaryKey = "data_grid.preview_sql.summary";
    const allKeys = [...noPlaceholderKeys, summaryKey];
    const base = catalogs["en-US"] as Record<string, string>;

    for (const language of SUPPORTED_LANGUAGES) {
      const catalog = catalogs[language] as Record<string, string>;
      for (const key of allKeys) {
        expect(catalog).toHaveProperty(key);
        expect(catalog[key]).toBeTruthy();
        expect(getPlaceholders(catalog[key])).toEqual(getPlaceholders(base[key]));
      }

      noPlaceholderKeys.forEach((key) => {
        expect(getPlaceholders(catalog[key])).toEqual([]);
      });
      expect(getPlaceholders(catalog[summaryKey])).toEqual(["deletes", "inserts", "updates"]);
      expect(catalog[summaryKey]).toContain("DELETE");
      expect(catalog[summaryKey]).toContain("UPDATE");
      expect(catalog[summaryKey]).toContain("INSERT");
    }

    const zhSummary = t("zh-CN", summaryKey, {
      deletes: "<raw-deletes>",
      updates: "<raw-updates>",
      inserts: "<raw-inserts>",
    });
    expect(zhSummary).toContain("<raw-deletes>");
    expect(zhSummary).toContain("<raw-updates>");
    expect(zhSummary).toContain("<raw-inserts>");
    expect(t("en-US", "data_grid.preview_sql.copied")).toBe("Copied");
  });

  it("keeps builtin function completion action labels localized beyond the english baseline in ja-JP de-DE and ru-RU", () => {
    const actionKeys = [
      "query_editor.completion.action.absolute_value",
      "query_editor.completion.action.bitmap_construction",
      "query_editor.completion.action.group_concatenation",
    ] as const;

    for (const language of ["ja-JP", "de-DE", "ru-RU"] as const) {
      for (const key of actionKeys) {
        expect(catalogs[language]).toHaveProperty(key);
        expect(catalogs[language][key]).toBeTruthy();
        expect(catalogs[language][key]).not.toBe(catalogs["en-US"][key]);
      }
    }
  });

  it("guards QueryEditor V2 empty state against inlining any catalog literal into source", () => {
    const emptyStateKeys = [
      "query_editor.empty_state.title",
      "query_editor.empty_state.description",
    ] as const;
    const inlineSource = [
      `<strong>${catalogs["en-US"]["query_editor.empty_state.title"]}</strong>`,
      `<span>${catalogs["en-US"]["query_editor.empty_state.description"]}</span>`,
    ].join("");

    expect(() => {
      assertSourceDoesNotInlineCatalogValues(inlineSource, emptyStateKeys);
    }).toThrowError(/catalog literal/i);
  });


});

