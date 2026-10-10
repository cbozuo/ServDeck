import Modal from './components/common/ResizableDraggableModal';
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { Layout, Button, ConfigProvider, theme, message, notification, Spin, Slider, Switch, Input, InputNumber, Select, Segmented, Tooltip, Alert } from 'antd';
import { UploadOutlined, DownloadOutlined, CloudDownloadOutlined, BugOutlined, GlobalOutlined, InfoCircleOutlined, GithubOutlined, SkinOutlined, CheckOutlined, SettingOutlined, LinkOutlined, BgColorsOutlined, FolderOpenOutlined, HddOutlined, SwitcherOutlined, CodeOutlined, RightOutlined, PoweroffOutlined, UserOutlined, MessageOutlined, FileTextOutlined, SyncOutlined, SendOutlined, AuditOutlined, ThunderboltOutlined, ApiOutlined, WechatOutlined, CopyOutlined } from '@ant-design/icons';
import { BrowserOpenURL, Environment, EventsOn, WindowFullscreen, WindowGetPosition, WindowGetSize, WindowIsFullscreen, WindowIsMaximised, WindowIsMinimised, WindowIsNormal, WindowMaximise, WindowMinimise, WindowSetDarkTheme, WindowSetLightTheme, WindowSetPosition, WindowSetSize, WindowSetSystemDefaultTheme, WindowUnfullscreen, WindowUnmaximise } from '../wailsjs/runtime';
import { ServiceTreeSidebar } from './components/serviceTree/ServiceTreeSidebar';
import TitleBarPrimaryActions from './components/TitleBarPrimaryActions';
import TitleBarSystemActions from './components/TitleBarSystemActions';
import { ManageServiceGroupsModal } from './components/serviceTree/ManageServiceGroupsModal';
import { AddServiceModal } from './components/AddServiceModal';
import TabManager from './components/TabManager';
import FloatingWorkbenchWindows from './components/FloatingWorkbenchWindows';
import NativeDetachedWindowController from './components/NativeDetachedWindowController';
import { TitleBarCloseIcon, TitleBarGearIcon, TitleBarMaximizeIcon, TitleBarMinimizeIcon, TitleBarPanelFoldIcon, TitleBarPanelUnfoldIcon, TitleBarRestoreIcon } from './components/TitleBarWindowControlIcons';
import UpdateReleaseNotesModal from './components/UpdateReleaseNotesModal';
import {
  buildReleaseNotesReadKey,
  isReleaseNotesRead,
  markReleaseNotesRead,
} from './utils/updateReleaseNotesReadState';
import LinuxCJKFontBanner from './components/LinuxCJKFontBanner';
import LogPanel from './components/LogPanel';
import LanguageSettingsPanel from './components/LanguageSettingsPanel';
import {
  resolveBrandIconSrc,
} from './brand/brandIcons';
import CustomThemeManager from './components/settings/CustomThemeManager';
import ToolbarButtonAppearanceSettings from './components/settings/ToolbarButtonAppearanceSettings';
import SettingsCenterTreeNav, {
  findSettingsCenterTreeItem,
} from './components/settings/SettingsCenterTreeNav';
import {
  DataDirectoryPage,
  DirectoryChoice,
  DirectoryMetaGrid,
  DirectoryNote,
  DirectoryPathDisplay,
  DirectorySectionHeading,
} from './components/settings/DataDirectorySettings';
import CustomThemeStyleHost, {
  type CustomThemeAntTokenSnapshot,
} from './components/theme/CustomThemeStyleHost';
import ToolbarAppearanceStyleHost from './components/theme/ToolbarAppearanceStyleHost';
import {
  AUTO_CHECK_FOR_UPDATES_INTERVAL_OPTIONS,
  DEFAULT_APPEARANCE,
  MAX_TAB_ENVIRONMENT_ACCENT_THICKNESS,
  MAX_V2_SIDEBAR_RAIL_SCALE,
  MIN_TAB_ENVIRONMENT_ACCENT_THICKNESS,
  MIN_V2_SIDEBAR_RAIL_SCALE,
  type ThemePreference,
  flushAppStatePersistence,
  useStore,
} from './store';
import { useCustomThemeStore } from './customThemeStore';
import { SavedConnection } from './types';
import { blurToFilter, normalizeBlurForPlatform, normalizeOpacityForPlatform, isMacLikePlatform, isWindowsPlatform, resolveAppearanceValues } from './utils/appearance';
import { buildFontFamilyOptions, DEFAULT_MONO_FONT_FAMILY, DEFAULT_UI_FONT_FAMILY, getLinuxCJKFontInstallHint, matchFontFamilyOption, resolveMonoFontFamily, resolveUIFontFamily, sanitizeFontFamilyInput, type FontFamilyOption, type InstalledFontFamily } from './utils/fontFamilies';
import {
  DENSITY_OPTIONS,
  sanitizeDataTableDensity,
  sanitizeDataTableFontSize,
  sanitizeSidebarTreeFontSize,
} from './utils/dataGridDisplay';
import {
  MAX_SQL_EDITOR_FONT_SIZE,
  MIN_SQL_EDITOR_FONT_SIZE,
  resolveSqlEditorFontSize,
  sanitizeSqlEditorFontSize,
} from './utils/sqlEditorTypography';
import {
  TAB_DISPLAY_SECONDARY_DEFAULT_KEYS,
  TAB_DISPLAY_ELEMENT_META,
  applyTabDisplaySettingsPatch,
  resolveTabDisplayElementOrder,
  sanitizeTabDisplaySettings,
  switchTabDisplayLayout,
  type TabDisplayElementKey,
  type TabDisplayLayout,
  type TabDisplaySettings,
} from './utils/tabDisplay';
import { getMacNativeTitlebarContentOffset, getMacNativeTitlebarPaddingLeft, getMacNativeTitlebarPaddingRight, shouldHandleMacNativeFullscreenShortcut, shouldSuppressMacNativeEscapeExit } from './utils/macWindow';
import { shouldEnableMacWindowDiagnostics } from './utils/macWindowDiagnostics';
import { getConnectionWorkbenchState } from './utils/startupReadiness';
import {
  buildSettingsCenterWorkbenchTab,
  SETTINGS_CENTER_WORKBENCH_TAB_ID,
} from './utils/settingsCenterTab';
import { SettingsCenterWorkbenchRegistrar } from './components/settings/SettingsCenterWorkbenchBridge';
import {
  extractCustomThemeAntTokens,
} from './utils/customTheme';
import { resolveAvailableCustomTheme } from './utils/customThemePresets';
import { bootstrapSecureConfig } from './utils/secureConfigBootstrap';
import { getWindowsScaleFixNudgedWidth } from './utils/windowsScaleFix';
import {
  clearStartupWindowRestorePending,
  isStartupMaximisedWindowSettled,
  isStartupWindowSurfaceCoveringViewport,
  isStartupWindowRestorePending,
  markStartupWindowRestorePending,
  resolveDefaultStartupWindowBounds,
  resolveStartupWindowRestoreMode,
  resolveWorkAreaFillWindowBounds,
} from './utils/windowStartupLayout';
import {
  SHORTCUT_ACTION_META,
  SHORTCUT_ACTION_ORDER,
  ShortcutAction,
  canRecordShortcutForAction,
  eventToShortcut,
  findEnabledActionConflicts,
  findReservedConflictsForAction,
  getShortcutDisplay,
  getShortcutDisplayLabel,
  getShortcutPlatform,
  installGlobalImeCompositionTracking,
  isEditableElement,
  isImeComposingKeyEvent,
  isShortcutMatch,
  normalizeShortcutCombo,
  resolveShortcutBinding,
  splitConflictsByContext,
  type ConflictInfo,
} from './utils/shortcuts';
import {
  dispatchCloseActiveResultTab,
  dispatchCloseActiveWorkspaceTab,
  isCloseShortcutInteractionBlocked,
  resolveCloseShortcutKeydownDecision,
  resolveCloseShortcutScopeFromTarget,
  resolveDockedActiveTabId,
  type CloseShortcutScope,
} from './utils/closeTabShortcut';
import {
  installWindowMaximizedFastMarker,
  installWindowResizeActivityMarker,
  installNativeWindowActivityScheduler,
  resolveTitleBarToggleIconKey,
  resolveWindowsScaleCheckDelayMs,
  WINDOW_STATE_FALLBACK_INTERVAL_MS,
  WINDOWS_SCALE_FALLBACK_INTERVAL_MS,
  type WindowScaleFixReason,
  type WindowsScaleCheckTrigger,
} from './utils/windowStateUi';
import { resolveVisibleStartupWindowBounds, type WindowRestoreBounds } from './utils/windowRestoreBounds';
import {
  applyRuntimeWindowPlacement,
  loadMainWindowDisplayLayout,
  resolveDisplayAwareLayout,
  resolveGlobalWindowBounds,
  resolveMaximisedWindowRestoreBounds,
  resolveRuntimeWindowPlacement,
  resolveVisibleGlobalWindowBounds,
  resolveWailsWindowPosition,
  type MainWindowDisplayLayout,
} from './utils/mainWindowDisplayPlacement';
import { markStartupWindowGeometrySettled } from './utils/mainWindowStartup';
import { resolveWailsWindowSetPosition, resolveWailsWindowVisibleViewport } from './utils/wailsWindowViewport';
import { safeWindowRuntimeCall } from './utils/wailsRuntime';
import { repairWindowsWindowScale } from './utils/windowsWindowScaleRepair';
import { waitForWindowCondition } from './utils/windowTransition';
import {
  hasNativeDetachedWindowManager,
  openNativeWorkbenchTabWindow,
} from './utils/nativeDetachedWindowHost';
import { prepareApplicationQuitPersistence } from './utils/applicationQuitPersistence';
import {
  APP_APPLICATION_QUIT_MODAL_Z_INDEX,
  APP_FOREGROUND_MODAL_Z_INDEX,
  APP_NESTED_MODAL_Z_INDEX,
  APP_OVERLAY_Z_INDEX_BASE,
} from './utils/overlayZIndex';
import { useAppUpdateManager } from './hooks/useAppUpdateManager';
import { useAppLogPanelResize } from './hooks/useAppLogPanelResize';
import { useAppSidebarCollapse } from './hooks/useAppSidebarCollapse';
import { useAppSidebarResize } from './hooks/useAppSidebarResize';
import { resolveSidebarResizeHitGeometry } from './utils/sidebarLayout';
import { useAppUtilityStyles } from './hooks/useAppUtilityStyles';
import { useWorkbenchTabs } from './hooks/useWorkbenchTabs';
import { isWailsDevNativeContextMenu, shouldAllowNativeContextMenu } from './utils/nativeContextMenu';
import {
  ApplyDataRootDirectory,
  ApplyServyEnginePath,
  CancelApplicationQuit,
  ForceQuitApplication,
  GetDataRootDirectoryInfo,
  GetServyEngineConfig,
  GetSavedConnections,
  ListInstalledFontFamilies,
  OpenDataRootDirectory,
  RestartApplication,
  SelectDataRootDirectory,
  SelectServyEngineFile,
  GetServiceLogRetentionDays,
  SetServiceLogRetentionDays,
  SetWindowTranslucency,
} from '../wailsjs/go/app/App';
import { SegmentedControl } from './addService/SegmentedControl';
import { getAntdLocale } from './i18n/frameworkLocale';
import { useI18n } from './i18n/provider';
import {
  normalizeTitlebarRuntimePlatform,
  resolveDockedTitleBarBandOffset,
  resolveDocumentPlatform,
  resolveTitleBarLayout,
  resolveTitlebarRuntimePlatform,
  shouldDockCollapsedSidebarActionsInTitlebar as resolveCollapsedSidebarDocking,
} from './utils/titlebarLayout';
import './App.css';
import './v2-theme.css';
import './styles/v2-theme-workbench.css';

const { Sider, Content } = Layout;
const MIN_UI_SCALE = 0.8;
const MAX_UI_SCALE = 1.25;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 20;
type ApplicationQuitConfirmedAction = () => Promise<boolean>;
/** 设置页 Slider 底部预设刻度 */
const UI_SCALE_SLIDER_MARKS: Record<number, string> = {
  0.8: '80%',
  0.9: '90%',
  1: '100%',
  1.1: '110%',
  1.25: '125%',
};
const FONT_SIZE_SLIDER_MARKS: Record<number, string> = {
  12: '12',
  14: '14',
  16: '16',
  18: '18',
  20: '20',
};
const SIDEBAR_RAIL_SCALE_SLIDER_MARKS: Record<number, string> = {
  1: '100%',
  1.25: '125%',
  1.5: '150%',
  1.8: '180%',
};
const TAB_ENVIRONMENT_ACCENT_THICKNESS_SLIDER_MARKS: Record<number, string> = {
  1: '1',
  2: '2',
  4: '4',
  6: '6',
};
const OPACITY_SLIDER_MARKS: Record<number, string> = {
  0.1: '10%',
  0.5: '50%',
  1: '100%',
};
const BLUR_SLIDER_MARKS: Record<number, string> = {
  0: '0',
  6: '6',
  12: '12',
  20: '20',
};
const DATA_TABLE_FONT_SLIDER_MARKS: Record<number, string> = {
  10: '10',
  12: '12',
  14: '14',
  16: '16',
  18: '18',
};
const SQL_EDITOR_FONT_SLIDER_MARKS: Record<number, string> = {
  ...DATA_TABLE_FONT_SLIDER_MARKS,
  20: '20',
};
const DEFAULT_UI_SCALE = 1.0;
const DEFAULT_FONT_SIZE = 14;
const sanitizeTabEnvironmentAccentThicknessLocal = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 2;
  return Math.min(MAX_TAB_ENVIRONMENT_ACCENT_THICKNESS, parsed);
};
const sanitizeV2SidebarRailScaleLocal = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(MAX_V2_SIDEBAR_RAIL_SCALE, parsed);
};
const EMPTY_INSTALLED_FONT_FAMILIES: InstalledFontFamily[] = [];

type ThemeSettingsSliderUnit = 'percent' | 'px' | 'none';

type ThemeSettingsSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  marks?: Record<number, string>;
  /** percent：右侧按百分比输入（内部仍用 0~1 / 0.8~1.25 比例） */
  unit?: ThemeSettingsSliderUnit;
};

const clampThemeSliderValue = (value: number, min: number, max: number, step?: number): number => {
  let next = Math.min(max, Math.max(min, value));
  if (step && step > 0) {
    const steps = Math.round((next - min) / step);
    next = min + steps * step;
    // 消除浮点误差
    const decimals = String(step).includes('.') ? (String(step).split('.')[1]?.length ?? 0) : 0;
    if (decimals > 0) {
      next = Number(next.toFixed(decimals));
    }
    next = Math.min(max, Math.max(min, next));
  }
  return next;
};

/** 主题设置页：滑条 + 底部预设 + 可编辑数值 */
const ThemeSettingsSlider: React.FC<ThemeSettingsSliderProps> = ({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
  marks,
  unit = 'none',
}) => {
  const isPercent = unit === 'percent';
  const minN = Number(min);
  const maxN = Number(max);
  const span = maxN - minN || 1;
  const stepN = step === undefined || step === null ? undefined : Number(step);
  const current = Number(value);
  const displayMin = isPercent ? minN * 100 : minN;
  const displayMax = isPercent ? maxN * 100 : maxN;
  const displayStep = isPercent
    ? (stepN !== undefined ? stepN * 100 : 1)
    : (stepN !== undefined ? stepN : 1);
  const displayValue = Number.isFinite(current)
    ? (isPercent ? Number((current * 100).toFixed(4)) : current)
    : displayMin;

  const commitDisplayValue = (raw: number | string | null) => {
    if (raw === null || raw === undefined || raw === '') {
      return;
    }
    const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/%/g, ''));
    if (!Number.isFinite(parsed)) {
      return;
    }
    const modelValue = isPercent ? parsed / 100 : parsed;
    onChange(clampThemeSliderValue(modelValue, minN, maxN, stepN));
  };

  const markEntries = marks
    ? Object.entries(marks).map(([raw, label]) => ({
        value: Number(raw),
        label,
      }))
    : [];

  return (
    <div className={`gonavi-settings-slider-row${marks ? ' has-marks' : ''}`}>
      <div className="gonavi-settings-slider-main">
        <div className="gonavi-settings-slider-track-wrap">
          <Slider
            min={minN}
            max={maxN}
            step={stepN}
            value={current}
            onChange={(next) => {
              const n = Array.isArray(next) ? next[0] : next;
              if (typeof n === 'number' && Number.isFinite(n)) {
                onChange(clampThemeSliderValue(n, minN, maxN, stepN));
              }
            }}
            disabled={disabled}
            tooltip={{ open: false }}
          />
        </div>
        {markEntries.length > 0 ? (
          <div className="gonavi-settings-slider-presets" role="group">
            {markEntries.map((mark) => {
              const pct = ((mark.value - minN) / span) * 100;
              const active = Number.isFinite(current)
                ? (stepN && stepN > 0
                  ? Math.abs(current - mark.value) <= stepN / 2 + 1e-9
                  : Math.abs(current - mark.value) < 1e-6)
                : false;
              return (
                <button
                  key={String(mark.value)}
                  type="button"
                  className={`gonavi-settings-slider-preset${active ? ' is-active' : ''}`}
                  style={{ left: `${pct}%` }}
                  disabled={Boolean(disabled)}
                  onClick={() => {
                    if (disabled) return;
                    onChange(clampThemeSliderValue(mark.value, minN, maxN, stepN));
                  }}
                >
                  {mark.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <InputNumber
        className="gonavi-settings-slider-value-input"
        size="small"
        min={displayMin}
        max={displayMax}
        step={displayStep}
        value={displayValue}
        disabled={disabled}
        controls={false}
        keyboard
        stringMode={false}
        style={{ width: unit === 'none' ? 48 : 62 }}
        addonAfter={unit === 'percent' ? '%' : unit === 'px' ? 'px' : undefined}
        onChange={(next) => {
          if (typeof next === 'number') {
            commitDisplayValue(next);
          }
        }}
        onBlur={(event) => {
          commitDisplayValue(event.target.value);
        }}
        onPressEnter={(event) => {
          commitDisplayValue((event.target as HTMLInputElement).value);
          (event.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
};

const detectNavigatorPlatform = (): string => {
  if (typeof navigator === 'undefined') {
      return '';
  }
  const uaDataPlatform = (navigator as Navigator & {
      userAgentData?: { platform?: string };
  }).userAgentData?.platform;
  if (uaDataPlatform) {
      return uaDataPlatform;
  }
  return navigator.userAgent || '';
};

const readCurrentVisibleViewport = () => resolveWailsWindowVisibleViewport(
  window.screen as Screen & { availLeft?: number; availTop?: number },
  { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
  { useMonitorLocalOrigin: isMacLikePlatform() },
);

const getSystemThemeMode = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};



type ToolCenterGroupKey = 'config';
type ToolCenterPaneKey = 'data-root-application';

type SettingsCenterGroupKey = 'preferences' | ToolCenterGroupKey | 'about';

/** 日志保留天数选项（-1 = 永久保留，禁用自动清理）。 */
const LOG_RETENTION_OPTIONS: Array<{ value: number }> = [
  { value: 7 },
  { value: 14 },
  { value: 30 },
  { value: 90 },
  { value: -1 },
];
type SettingsCenterPaneKey =
  | 'language'
  | 'theme'
  | ToolCenterPaneKey
  | 'about-go-navi';
type SettingsCenterPaneState = {
  key: SettingsCenterPaneKey;
  group: SettingsCenterGroupKey;
};

const isToolCenterGroupKey = (group: SettingsCenterGroupKey): group is ToolCenterGroupKey => (
  group === 'config'
);

const resolveSettingsCenterGroupInitialPane = (group: SettingsCenterGroupKey): SettingsCenterPaneState | null => {
  switch (group) {
    case 'preferences':
      return { key: 'language', group };
    case 'config':
      return { key: 'data-root-application', group };
    case 'about':
      return { key: 'about-go-navi', group };
    default:
      return null;
  }
};

const formatAboutCheckedAt = (value: Date): string => {
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const formatAboutReleaseTime = (value: string | undefined): string => {
  const text = String(value || '').trim();
  if (!text) {
    return '-';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return formatAboutCheckedAt(date);
};

function App() {
  const { language, t } = useI18n();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const windowState = useStore(state => state.windowState);
  const themeMode = useStore(state => state.theme);
  const themePreference = useStore(state => state.themePreference);
  const brandIconId = useStore(state => state.brandIconId);
  const setTheme = useStore(state => state.setTheme);
  const setThemePreference = useStore(state => state.setThemePreference);
  const customThemes = useCustomThemeStore(state => state.themes);
  const activeCustomThemeId = useCustomThemeStore(state => state.activeThemeId);
  const selectCustomTheme = useCustomThemeStore(state => state.selectCustomTheme);
  const appearance = useStore(state => state.appearance);
  const setAppearance = useStore(state => state.setAppearance);
  const uiScale = useStore(state => state.uiScale);
  const setUiScale = useStore(state => state.setUiScale);
  const fontSize = useStore(state => state.fontSize);
  const setFontSize = useStore(state => state.setFontSize);
  // Keep reading the legacy persisted field; its product meaning is now startup maximise.
  const startupMaximised = useStore(state => state.startupFullscreen);
  const setStartupMaximised = useStore(state => state.setStartupFullscreen);
  const autoCheckForUpdates = useStore(state => state.autoCheckForUpdates);
  const setAutoCheckForUpdates = useStore(state => state.setAutoCheckForUpdates);
  const autoCheckForUpdatesIntervalMinutes = useStore(state => state.autoCheckForUpdatesIntervalMinutes);
  const setAutoCheckForUpdatesIntervalMinutes = useStore(state => state.setAutoCheckForUpdatesIntervalMinutes);
  const replaceConnections = useStore(state => state.replaceConnections);
  const shortcutOptions = useStore(state => state.shortcutOptions);
  const [systemThemeMode, setSystemThemeMode] = useState<'light' | 'dark'>(() => getSystemThemeMode());
  const [runtimePlatform, setRuntimePlatform] = useState('');
  const [runtimeBuildType, setRuntimeBuildType] = useState('');
  const [isLinuxRuntime, setIsLinuxRuntime] = useState(false);
  const activeCustomTheme = useMemo(
      () => resolveAvailableCustomTheme(customThemes, activeCustomThemeId),
      [activeCustomThemeId, customThemes],
  );
  const effectiveThemePreference = activeCustomTheme?.baseMode ?? themePreference;
  const resolvedThemeMode = effectiveThemePreference === 'system'
      ? systemThemeMode
      : effectiveThemePreference;
  const darkMode = resolvedThemeMode === 'dark';
  const sourceCustomThemeAntTokens = useMemo(
      () => activeCustomTheme ? extractCustomThemeAntTokens(activeCustomTheme.css) : {},
      [activeCustomTheme],
  );
  const [computedCustomThemeAntTokens, setComputedCustomThemeAntTokens] = useState<CustomThemeAntTokenSnapshot | null>(null);
  const customThemeStyleContextKey = `${resolvedThemeMode}:v2`;
  const customThemeAntTokens = activeCustomTheme
      && computedCustomThemeAntTokens?.themeId === activeCustomTheme.id
      && computedCustomThemeAntTokens.themeRevision === activeCustomTheme.updatedAt
      && computedCustomThemeAntTokens.contextKey === customThemeStyleContextKey
      ? computedCustomThemeAntTokens.tokens
      : sourceCustomThemeAntTokens;

  const effectiveUiScale = Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, Number(uiScale) || DEFAULT_UI_SCALE));
  const effectiveFontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(Number(fontSize) || DEFAULT_FONT_SIZE)));
  const tokenFontSize = Math.round(effectiveFontSize * effectiveUiScale);
  const titleBarToggleIconKey = resolveTitleBarToggleIconKey(
      windowState === 'fullscreen' ? 'fullscreen' : (windowState === 'maximized' ? 'maximized' : 'normal')
  );
  const tokenFontSizeSM = Math.max(10, Math.round(tokenFontSize * 0.86));
  const tokenFontSizeLG = Math.max(tokenFontSize + 1, Math.round(tokenFontSize * 1.14));
  const tokenControlHeight = Math.max(24, Math.round(32 * effectiveUiScale));
  const tokenControlHeightSM = Math.max(20, Math.round(24 * effectiveUiScale));
  const tokenControlHeightLG = Math.max(30, Math.round(40 * effectiveUiScale));
  const dataTableFontSizeFollowsGlobal = appearance.dataTableFontSizeFollowGlobal !== false;
  const sqlEditorFontSizeFollowsGlobal = appearance.sqlEditorFontSizeFollowGlobal !== false;
  const sidebarTreeFontSizeFollowsGlobal = appearance.sidebarTreeFontSizeFollowGlobal !== false;
  const effectiveDataTableFontSize = dataTableFontSizeFollowsGlobal
      ? effectiveFontSize
      : (sanitizeDataTableFontSize(appearance.dataTableFontSize) ?? effectiveFontSize);
  const effectiveSqlEditorFontSize = resolveSqlEditorFontSize({
      globalFontSize: effectiveFontSize,
      sqlEditorFontSize: appearance.sqlEditorFontSize,
      sqlEditorFontSizeFollowGlobal: appearance.sqlEditorFontSizeFollowGlobal,
  });
  const effectiveSidebarTreeFontSize = sidebarTreeFontSizeFollowsGlobal
      ? effectiveFontSize
      : (sanitizeSidebarTreeFontSize(appearance.sidebarTreeFontSize) ?? effectiveFontSize);
  const effectiveSidebarRailScale = sanitizeV2SidebarRailScaleLocal(appearance.v2SidebarRailScale);
  const effectiveTabEnvironmentAccentThickness = sanitizeTabEnvironmentAccentThicknessLocal(
      appearance.tabEnvironmentAccentThickness,
  );
  const tabDisplaySettings = useMemo(
      () => sanitizeTabDisplaySettings(appearance.tabDisplay),
      [appearance.tabDisplay],
  );
  const tabDisplayElementOrder = useMemo(
      () => resolveTabDisplayElementOrder(tabDisplaySettings),
      [tabDisplaySettings],
  );
  const visibleTabDisplayElementKeys = useMemo(
      () => new Set<TabDisplayElementKey>([
          ...tabDisplaySettings.primaryElements,
          ...tabDisplaySettings.secondaryElements,
      ]),
      [tabDisplaySettings],
  );
  const getTabDisplayElementLabel = useCallback(
      (key: TabDisplayElementKey) => t(TAB_DISPLAY_ELEMENT_META[key].labelKey),
      [t],
  );
  const getTabDisplayElementDescription = useCallback(
      (key: TabDisplayElementKey) => t(TAB_DISPLAY_ELEMENT_META[key].descriptionKey),
      [t],
  );
  useEffect(() => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
          return;
      }
      const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystemTheme = (matches: boolean) => {
          setSystemThemeMode(matches ? 'dark' : 'light');
      };
      applySystemTheme(mediaQueryList.matches);
      const handleChange = (event: MediaQueryListEvent) => {
          applySystemTheme(event.matches);
      };
      if (typeof mediaQueryList.addEventListener === 'function') {
          mediaQueryList.addEventListener('change', handleChange);
          return () => {
              mediaQueryList.removeEventListener('change', handleChange);
          };
      }
      mediaQueryList.addListener(handleChange);
      return () => {
          mediaQueryList.removeListener(handleChange);
      };
  }, []);
  useEffect(() => {
      if (themeMode !== resolvedThemeMode) {
          setTheme(resolvedThemeMode);
      }
      if (effectiveThemePreference === 'system') {
          void safeWindowRuntimeCall(() => WindowSetSystemDefaultTheme(), undefined);
          return;
      }
      if (resolvedThemeMode === 'dark') {
          void safeWindowRuntimeCall(() => WindowSetDarkTheme(), undefined);
          return;
      }
      void safeWindowRuntimeCall(() => WindowSetLightTheme(), undefined);
  }, [effectiveThemePreference, resolvedThemeMode, setTheme, themeMode]);

  // Use the bundled application brand for the browser favicon.
  useEffect(() => {
      if (typeof document === 'undefined') return;
      const href = resolveBrandIconSrc(brandIconId);
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-brand-icon='true']");
      if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          link.setAttribute('data-brand-icon', 'true');
          document.head.appendChild(link);
      }
      link.type = 'image/svg+xml';
      link.href = href;

  }, [brandIconId]);

  const selectPresetTheme = useCallback((preference: ThemePreference) => {
      // Custom CSS is an independent skin layer. Selecting a built-in preset
      // first disables that layer, then preserves the existing 3-mode contract.
      if (activeCustomTheme) {
          const result = selectCustomTheme(null);
          if (!result.ok) message.warning(t('app.theme.custom.error.storage_failed'));
      }
      setThemePreference(preference);
  }, [activeCustomTheme, selectCustomTheme, setThemePreference, t]);
  const setTabDisplaySettings = useCallback((settings: Partial<TabDisplaySettings>) => {
      setAppearance({
          tabDisplay: applyTabDisplaySettingsPatch(tabDisplaySettings, settings),
      });
  }, [setAppearance, tabDisplaySettings]);
  const setTabDisplayLayout = useCallback((layout: TabDisplayLayout) => {
      if (layout === tabDisplaySettings.layout) return;
      setAppearance({
          tabDisplay: switchTabDisplayLayout(tabDisplaySettings, layout),
      });
  }, [setAppearance, tabDisplaySettings]);
  const updateTabDisplayElementVisibility = useCallback((key: TabDisplayElementKey, checked: boolean) => {
      setFocusedTabDisplayElementKey(key);
      const removeKey = (keys: TabDisplayElementKey[]) => keys.filter((item) => item !== key);
      if (!checked) {
          setTabDisplaySettings({
              layout: tabDisplaySettings.layout,
              primaryElements: removeKey(tabDisplaySettings.primaryElements),
              secondaryElements: removeKey(tabDisplaySettings.secondaryElements),
          });
          return;
      }

      const primaryElements = removeKey(tabDisplaySettings.primaryElements);
      const secondaryElements = removeKey(tabDisplaySettings.secondaryElements);
      if (tabDisplaySettings.layout === 'double' && TAB_DISPLAY_SECONDARY_DEFAULT_KEYS.includes(key)) {
          secondaryElements.push(key);
      } else {
          primaryElements.push(key);
      }
      setTabDisplaySettings({
          layout: tabDisplaySettings.layout,
          primaryElements,
          secondaryElements,
      });
  }, [setTabDisplaySettings, tabDisplaySettings]);
  const moveTabDisplayElement = useCallback((key: TabDisplayElementKey, offset: -1 | 1) => {
      setFocusedTabDisplayElementKey(key);
      const moveWithin = (keys: TabDisplayElementKey[]) => {
          const index = keys.indexOf(key);
          if (index < 0) return keys;
          const nextIndex = index + offset;
          if (nextIndex < 0 || nextIndex >= keys.length) return keys;
          const next = [...keys];
          [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
          return next;
      };

      setTabDisplaySettings({
          layout: tabDisplaySettings.layout,
          primaryElements: moveWithin(tabDisplaySettings.primaryElements),
          secondaryElements: moveWithin(tabDisplaySettings.secondaryElements),
      });
  }, [setTabDisplaySettings, tabDisplaySettings]);
  const setTabDisplayElementRow = useCallback((key: TabDisplayElementKey, row: 'primary' | 'secondary') => {
      setFocusedTabDisplayElementKey(key);
      const primaryElements = tabDisplaySettings.primaryElements.filter((item) => item !== key);
      const secondaryElements = tabDisplaySettings.secondaryElements.filter((item) => item !== key);
      if (row === 'primary') {
          primaryElements.push(key);
      } else {
          secondaryElements.push(key);
      }
      setTabDisplaySettings({
          layout: tabDisplaySettings.layout,
          primaryElements,
          secondaryElements,
      });
  }, [setTabDisplaySettings, tabDisplaySettings]);
  const resolvedUiFontFamily = resolveUIFontFamily(appearance.customUIFontFamily);
  const resolvedMonoFontFamily = resolveMonoFontFamily(appearance.customMonoFontFamily);
  const appComponentSize: 'small' | 'middle' | 'large' = effectiveUiScale <= 0.92 ? 'small' : (effectiveUiScale >= 1.12 ? 'large' : 'middle');
  // IDEA 风格:窗口按钮为正方形,宽度与标题栏高度一致(hover 背景呈正方形)。
  const titleBarButtonWidth = Math.max(28, Math.round(40 * effectiveUiScale));
  const floatingLogButtonHeight = Math.max(30, Math.round(34 * effectiveUiScale));
  const resolvedAppearance = resolveAppearanceValues(appearance);
  const effectiveOpacity = normalizeOpacityForPlatform(resolvedAppearance.opacity);
  const effectiveBlur = normalizeBlurForPlatform(resolvedAppearance.blur);
  const blurFilter = blurToFilter(effectiveBlur);
  const isWebRuntime = runtimeBuildType === 'web'
    || (typeof window !== 'undefined' && (window as any).__GONAVI_WEB_RUNTIME__?.buildType === 'web');
  const [installedFontFamilies, setInstalledFontFamilies] = useState<InstalledFontFamily[]>(EMPTY_INSTALLED_FONT_FAMILIES);
  const [isFontFamiliesLoading, setIsFontFamiliesLoading] = useState(false);
  const [fontFamiliesLoadError, setFontFamiliesLoadError] = useState<string | null>(null);
  const hasLoadedInstalledFontsRef = useRef(false);
  const uiFontOptions = useMemo(
      () => buildFontFamilyOptions(runtimePlatform, 'ui', installedFontFamilies, t),
      [installedFontFamilies, runtimePlatform, t],
  );
  const monoFontOptions = useMemo(
      () => buildFontFamilyOptions(runtimePlatform, 'mono', installedFontFamilies, t),
      [installedFontFamilies, runtimePlatform, t],
  );
  const linuxCJKFontInstallHint = getLinuxCJKFontInstallHint(runtimePlatform, installedFontFamilies);
  const [isStoreHydrated, setIsStoreHydrated] = useState(() => useStore.persist.hasHydrated());
  const [hasLoadedSecureConfig, setHasLoadedSecureConfig] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth || 1280));
  /** 设置中心 = workbench tab 形态（2026-09-29 曾短暂改为弹框后按用户要求回退）。
      服务详情 2026-09-30 起同为 tab 形态，两者可并存，无需再强制退出详情页。 */
  const isSettingsModalOpen = useStore((state) => state.tabs.some((tab) => tab.id === SETTINGS_CENTER_WORKBENCH_TAB_ID));
  const openSettingsCenterWorkbenchTab = useCallback(() => {
      useStore.getState().addTab(buildSettingsCenterWorkbenchTab());
  }, []);
  const closeSettingsCenterWorkbenchTab = useCallback(() => {
      const { tabs, closeTab } = useStore.getState();
      if (tabs.some((tab) => tab.id === SETTINGS_CENTER_WORKBENCH_TAB_ID)) {
          closeTab(SETTINGS_CENTER_WORKBENCH_TAB_ID);
      }
  }, []);
  const [isManageServiceGroupsOpen, setIsManageServiceGroupsOpen] = useState(false);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [activeSettingsCenterGroupKey, setActiveSettingsCenterGroupKey] = useState<SettingsCenterGroupKey>('preferences');
  const [activeSettingsCenterPane, setActiveSettingsCenterPane] = useState<SettingsCenterPaneState | null>(null);
  const activeSettingsCenterPaneRef = useRef<SettingsCenterPaneState | null>(null);
  activeSettingsCenterPaneRef.current = activeSettingsCenterPane;
  const [focusedTabDisplayElementKey, setFocusedTabDisplayElementKey] = useState<TabDisplayElementKey | null>(null);
  const sidebarWidth = useStore(state => state.sidebarWidth);
  const setSidebarWidth = useStore(state => state.setSidebarWidth);
  const navigatorPlatform = detectNavigatorPlatform();
  const documentPlatform = resolveDocumentPlatform(runtimePlatform, navigatorPlatform);
  const titlebarRuntimePlatform = resolveTitlebarRuntimePlatform(runtimePlatform, navigatorPlatform);
  const isMacRuntime = titlebarRuntimePlatform === 'darwin';
  const shouldDockCollapsedSidebarActionsInTitlebar = resolveCollapsedSidebarDocking(
      runtimePlatform,
      navigatorPlatform,
      isWebRuntime,
  );
  const {
      collapsedSidebarActionsTarget,
      handleCollapseSidebarPanel,
      handleEnsureSidebarExpanded,
      handleExpandSidebarPanel,
      isCollapsedSidebarActionsDocked,
      isSidebarCollapsed,
      setCollapsedSidebarActionsTarget,
      setIsSidebarCollapsed,
      sidebarCollapsedToggleRef,
      sidebarContentRef,
      sidebarExplorerToggleRef,
  } = useAppSidebarCollapse(shouldDockCollapsedSidebarActionsInTitlebar);
  const titleBarLayout = resolveTitleBarLayout(
      effectiveUiScale,
      isCollapsedSidebarActionsDocked,
      effectiveSidebarRailScale,
  );
  const titleBarHeight = titleBarLayout.height;
  const [brandLogoHovered, setBrandLogoHovered] = useState(false);
  // 纯净收起：侧栏整体滑出（宽度 0），不留 fixed-rail 功能图标——
  // 展开入口为标题栏「折叠左侧树」按钮。
  const sidebarCollapsedWidth = 0;
  const renderedSidebarWidth = isSidebarCollapsed ? sidebarCollapsedWidth : sidebarWidth;
  const settingsCenterModalZIndex = APP_FOREGROUND_MODAL_Z_INDEX;
  const settingsChildModalZIndex = Math.max(
    APP_NESTED_MODAL_Z_INDEX,
    settingsCenterModalZIndex + 100,
  );
  const applicationQuitModalZIndex = Math.max(
    APP_APPLICATION_QUIT_MODAL_Z_INDEX,
    settingsChildModalZIndex + 100,
  );
  const windowDiagSequenceRef = React.useRef(0);
  const windowDiagLastSignatureRef = React.useRef('');
  const windowDiagLastAtRef = React.useRef(0);
  const captureMainWindowStateRef = React.useRef<() => Promise<void>>(async () => undefined);
  const connectionWorkbenchState = getConnectionWorkbenchState(
      isStoreHydrated,
      hasLoadedSecureConfig,
      true,
  );

  const windowCornerRadius = 14;
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // 只在跨越 760px 断点时才更新 state,避免每个 resize 事件触发全应用重渲染
    let lastSide = (window.innerWidth || 0) < 760;
    const syncViewportWidth = () => {
      const width = window.innerWidth || document.documentElement?.clientWidth || 1280;
      const side = width < 760;
      if (side !== lastSide) {
        lastSide = side;
        setViewportWidth(width);
      }
    };
    syncViewportWidth();
    window.addEventListener('resize', syncViewportWidth);
    return () => window.removeEventListener('resize', syncViewportWidth);
  }, []);

  useEffect(()=>{
    if (typeof document === 'undefined' || !document.body) {
        return;
    }
    switch(windowState){
        case 'fullscreen':
        case 'maximized':
            document.body.style.setProperty('--gonavi-border-radius', '0px');
            break;
        default:
            document.body.style.setProperty('--gonavi-border-radius', `${windowCornerRadius}px`);
            break;
    }
  }, [windowState]);

  // 同步 macOS 窗口透明度：opacity=1.0 且 blur=0 时关闭 NSVisualEffectView，
  // 避免 GPU 持续计算窗口背后的模糊合成
  useEffect(() => {
    try {
        void SetWindowTranslucency(resolvedAppearance.opacity, resolvedAppearance.blur, darkMode).catch(() => undefined);
    } catch(e) { /* ignore */ }
  }, [darkMode, resolvedAppearance.blur, resolvedAppearance.opacity]);

  useEffect(() => {
      let cancelled = false;
      try {
          Environment()
              .then((env) => {
                  if (cancelled) return;
                  const platform = normalizeTitlebarRuntimePlatform(String(env?.platform || ''));
                  setRuntimePlatform(platform);
                  setRuntimeBuildType(String(env?.buildType || '').trim().toLowerCase());
                  setIsLinuxRuntime(platform === 'linux');
              })
              .catch(() => {
                  if (cancelled) return;
                  const normalized = resolveDocumentPlatform('', detectNavigatorPlatform());
                  setRuntimePlatform(normalized);
                  setIsLinuxRuntime(normalized === 'linux');
              });
      } catch(e) {
          if (cancelled) return;
          const normalized = resolveDocumentPlatform('', detectNavigatorPlatform());
          setRuntimePlatform(normalized);
          setIsLinuxRuntime(normalized === 'linux');
      }
      return () => {
          cancelled = true;
      };
  }, []);

  useEffect(() => {
      if (isStoreHydrated) {
          return;
      }
      const unsubscribe = useStore.persist.onFinishHydration(() => {
          setIsStoreHydrated(true);
      });
      return () => {
          unsubscribe();
      };
  }, [isStoreHydrated]);

  useEffect(() => {
      if (!isStoreHydrated) {
          return;
      }

      let cancelled = false;
      const loadSecureConfig = async () => {
          try {
              await bootstrapSecureConfig({
                  backend: (window as any).go?.app?.App,
                  autoStartLegacySecurityUpdate: true,
                  replaceConnections,
                  t,
              });
              if (cancelled) {
                  return;
              }
          } catch (err) {
              console.warn('Failed to bootstrap secure config', err);
          } finally {
              if (!cancelled) {
                  setHasLoadedSecureConfig(true);
              }
          }
      };

      void loadSecureConfig();
      return () => {
          cancelled = true;
      };
  }, [isStoreHydrated, replaceConnections, t]);



  useEffect(() => {
      let cancelled = false;
      let startupWindowTimer: number | null = null;
      let restoredOnce = false;
      const maxApplyAttempts = 8;
      const applyRetryDelayMs = 350;
      const settleDelayMs = 180;
      const startupRestoreGraceMs = 6000;
      let refreshWebViewBoundsUnavailableLogged = false;
      let refreshWebViewBoundsDisabled = false;
      const wait = (delayMs: number) => new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));

      const waitForMaximisedState = (expected: boolean): Promise<boolean> => waitForWindowCondition({
          read: async () => (await WindowIsMaximised()) === expected,
          wait,
          isCancelled: () => cancelled,
          maxChecks: 16,
          intervalMs: 40,
      });

      const checkStartupPreferenceApplied = async (): Promise<boolean> => {
          try {
              const [isMaximised, size] = await Promise.all([
                  WindowIsMaximised(),
                  WindowGetSize(),
              ]);
              return isStartupMaximisedWindowSettled({
                  windowWidth: Number(size?.w),
                  windowHeight: Number(size?.h),
                  isMaximised,
                  isWindows: isWindowsPlatform(),
                  surfaceWidth: window.innerWidth,
                  surfaceHeight: window.innerHeight,
                  viewport: readCurrentVisibleViewport(),
              });
          } catch (_) {
              // ignore
          }
          return false;
      };

      const tryRefreshStartupWebViewBounds = async (): Promise<boolean> => {
          if (
              !isWindowsPlatform()
              || refreshWebViewBoundsDisabled
              || (window as any).__GONAVI_WEB_RUNTIME__?.buildType === 'web'
          ) {
              return false;
          }
          const backendApp = (window as any).go?.app?.App;
          if (typeof backendApp?.RefreshWebViewBounds !== 'function') {
              refreshWebViewBoundsDisabled = true;
              if (!refreshWebViewBoundsUnavailableLogged) {
                  refreshWebViewBoundsUnavailableLogged = true;
                  console.warn('RefreshWebViewBounds backend is unavailable during startup maximise');
              }
              return false;
          }
          try {
              const result = await backendApp.RefreshWebViewBounds();
              if (result?.success) {
                  window.dispatchEvent(new Event('resize'));
                  return true;
              }
              refreshWebViewBoundsDisabled = true;
              if (!refreshWebViewBoundsUnavailableLogged) {
                  refreshWebViewBoundsUnavailableLogged = true;
                  console.warn('RefreshWebViewBounds failed during startup maximise:', result?.message);
              }
          } catch (error) {
              refreshWebViewBoundsDisabled = true;
              if (!refreshWebViewBoundsUnavailableLogged) {
                  refreshWebViewBoundsUnavailableLogged = true;
                  console.warn('RefreshWebViewBounds call failed during startup maximise', error);
              }
          }
          return false;
      };

      const waitForNativeWindowBounds = (bounds: {
          width: number;
          height: number;
          x: number;
          y: number;
      }): Promise<boolean> => waitForWindowCondition({
          read: async () => {
              const [size, position] = await Promise.all([
                  WindowGetSize(),
                  WindowGetPosition(),
              ]);
              return Math.abs(Math.trunc(Number(size?.w)) - bounds.width) <= 2
                  && Math.abs(Math.trunc(Number(size?.h)) - bounds.height) <= 2
                  && Math.abs(Math.trunc(Number(position?.x)) - bounds.x) <= 2
                  && Math.abs(Math.trunc(Number(position?.y)) - bounds.y) <= 2;
          },
          wait,
          isCancelled: () => cancelled,
          maxChecks: 16,
          intervalMs: 40,
      });

      const waitForStartupPreferenceApplied = (): Promise<boolean> => waitForWindowCondition({
          read: checkStartupPreferenceApplied,
          wait,
          isCancelled: () => cancelled,
          maxChecks: 10,
          intervalMs: 40,
      });

      const repairStartupMaximisedSurface = async (): Promise<boolean> => {
          if (!isWindowsPlatform()) {
              return false;
          }
          markStartupWindowRestorePending(startupRestoreGraceMs);
          WindowUnmaximise();
          if (!await waitForMaximisedState(false)) {
              return false;
          }
          WindowMaximise();
          if (!await waitForMaximisedState(true)) {
              return false;
          }
          await tryRefreshStartupWebViewBounds();
          return waitForStartupPreferenceApplied();
      };

      const markStartupMaximised = () => {
          // 启动偏好成功后立刻同步实际窗口态，避免 settle 宽限期留下瞬态 normal。
          useStore.getState().setWindowState('maximized');
          clearStartupWindowRestorePending();
          // 最大化已落到最终几何，放行主窗口首屏显示。
          markStartupWindowGeometrySettled();
      };

      /** Maximise 多次失败时：退回普通窗口并铺满工作区，避免残留默认半窗。 */
      const applyWindowsWorkAreaFillFallback = async (): Promise<boolean> => {
          if (!isWindowsPlatform()) {
              return false;
          }
          try {
              markStartupWindowRestorePending(startupRestoreGraceMs);
              if (await WindowIsMaximised()) {
                  WindowUnmaximise();
                  if (!await waitForMaximisedState(false)) {
                      return false;
                  }
              }
              const viewport = readCurrentVisibleViewport();
              const nextBounds = resolveWorkAreaFillWindowBounds(viewport);
              const setPosition = resolveWailsWindowSetPosition(nextBounds, viewport, {
                  useMonitorLocalOrigin: true,
              });
              WindowSetPosition(setPosition.x, setPosition.y);
              WindowSetSize(nextBounds.width, nextBounds.height);
              const boundsApplied = await waitForNativeWindowBounds(nextBounds);
              if (!boundsApplied) {
                  return false;
              }
              await tryRefreshStartupWebViewBounds();
              const surfaceFilled = await waitForWindowCondition({
                  read: async () => isStartupWindowSurfaceCoveringViewport({
                      surfaceWidth: window.innerWidth,
                      surfaceHeight: window.innerHeight,
                      viewport: readCurrentVisibleViewport(),
                  }),
                  wait,
                  isCancelled: () => cancelled,
                  maxChecks: 10,
                  intervalMs: 40,
              });
              if (!surfaceFilled) return false;
              useStore.getState().setWindowBounds(nextBounds);
              useStore.getState().setWindowState('normal');
              void emitWindowDiagnostic('adjust:startup-work-area-fill-fallback', {
                  to: nextBounds,
              });
              markStartupWindowGeometrySettled();
              return true;
          } catch (e) {
              console.warn('Failed to apply Windows work-area fill fallback', e);
              return false;
          }
      };

      // Windows、Linux 与 macOS 的启动偏好都使用普通窗口最大化，不进入系统全屏。
      // 第 1 次立即执行（delay=0），缩短普通窗口首帧到目标窗口态的过渡。
      const applyStartupWindowChrome = (attempt: number) => {
          if (startupWindowTimer !== null) {
              window.clearTimeout(startupWindowTimer);
          }
          const delayMs = attempt <= 1 ? 0 : applyRetryDelayMs;
          startupWindowTimer = window.setTimeout(() => {
              if (cancelled) {
                  return;
              }
              void Promise.resolve()
                  .then(async () => {
                      markStartupWindowRestorePending(startupRestoreGraceMs);
                      if (await checkStartupPreferenceApplied()) {
                          markStartupMaximised();
                          return;
                      }
                      try {
                          WindowMaximise();
                          if (await waitForMaximisedState(true)) {
                              await tryRefreshStartupWebViewBounds();
                          }
                      } catch (e) {
                          console.warn("Wails Window APIs unavailable", e);
                      }

                      if (await waitForStartupPreferenceApplied()) {
                          markStartupMaximised();
                          return;
                      }
                      if (attempt < maxApplyAttempts) {
                          applyStartupWindowChrome(attempt + 1);
                      } else {
                          // WebView2 controller bounds may remain at the initial 1440x900 even
                          // after WS_MAXIMIZE is set. Use one cold-start-only native transition
                          // if the zero-animation bounds refresh could not settle the surface.
                          if (await repairStartupMaximisedSurface()) {
                              markStartupMaximised();
                              return;
                          }
                          // 最终仍失败：Windows 铺满工作区兜底，再结束宽限
                          void emitWindowDiagnostic('warn:startup-maximise-failed', {
                              attempts: attempt,
                          });
                          const fallbackApplied = await applyWindowsWorkAreaFillFallback();
                          if (!fallbackApplied) {
                              void emitWindowDiagnostic('error:startup-work-area-fill-fallback-failed');
                          }
                          clearStartupWindowRestorePending();
                          // 启动偏好最终没能生效：仍放行首屏，避免窗口一直隐藏。
                          markStartupWindowGeometrySettled();
                      }
                  });
          }, delayMs);
      };

      const applyRestoredWindowBounds = (
          bounds: WindowRestoreBounds,
          displayLayout?: MainWindowDisplayLayout | null,
      ) => {
          const state = useStore.getState();
          const placement = resolveRuntimeWindowPlacement(
              bounds, displayLayout ?? null, readCurrentVisibleViewport(), isWindowsPlatform(), true,
          );
          if (!placement) {
              void emitWindowDiagnostic('warn:startup-window-display-unavailable', { from: bounds });
              return bounds;
          }
          const nextBounds = placement.bounds;
          if (
              nextBounds.x !== bounds.x ||
              nextBounds.y !== bounds.y ||
              nextBounds.width !== bounds.width ||
              nextBounds.height !== bounds.height
          ) {
              void emitWindowDiagnostic('adjust:startup-window-bounds', {
                  from: bounds,
                  to: nextBounds,
              });
          }
          applyRuntimeWindowPlacement(placement, isWindowsPlatform(), WindowSetSize, WindowSetPosition);
          state.setWindowBounds(nextBounds);
          return nextBounds;
      };

      const restoreNormalWindowBounds = async (
          bounds: WindowRestoreBounds,
          layout: MainWindowDisplayLayout | null,
      ) => {
          try {
              if (await WindowIsFullscreen()) {
                  WindowUnfullscreen();
                  await new Promise((resolve) => window.setTimeout(resolve, settleDelayMs));
              }
              if (await WindowIsMaximised()) {
                  WindowUnmaximise();
                  await new Promise((resolve) => window.setTimeout(resolve, settleDelayMs));
              }
          } catch (e) {
              console.warn('Failed to restore normal window chrome', e);
          }
          const appliedBounds = applyRestoredWindowBounds(bounds, layout);
          // Wails can finish the native normal-window transition before the
          // WebView2 controller receives its first size update. Wait for the
          // native rect, then explicitly resize the controller just as the
          // maximised startup path does.
          if (isWindowsPlatform()) {
              await waitForNativeWindowBounds(appliedBounds);
              await tryRefreshStartupWebViewBounds();
          }
          useStore.getState().setWindowState('normal');
      };

      const restoreWindowState = async () => {
          if (cancelled) return;
          // 仅在 hydration 完成后跑一次（或显式重入）；避免未水合默认态先写半窗 bounds
          if (!useStore.persist.hasHydrated()) {
              return;
          }
          if (restoredOnce) {
              return;
          }
          restoredOnce = true;
          await applyStartupWindowState();
      };

      const applyStartupWindowState = async () => {
          const state = useStore.getState();
          const bounds = state.windowBounds;
          const layout = await loadMainWindowDisplayLayout();
          if (cancelled) return;
          const restoreMode = resolveStartupWindowRestoreMode(
              state.startupFullscreen,
              state.windowState,
          );
          if (restoreMode !== 'normal') {
              markStartupWindowRestorePending(startupRestoreGraceMs);
              if (bounds && bounds.width >= 400 && bounds.height >= 300) {
                  try {
                      // Seed the OS restore rectangle before maximising so a later
                      // unmaximise returns to the last normal bounds. A frontend
                      // reload may already be maximised: SetSize in that state
                      // shrinks the HWND while its client area stays maximised.
                      if (!await WindowIsMaximised() && !await WindowIsFullscreen() && !cancelled) {
                          const appliedBounds = applyRestoredWindowBounds(bounds, layout);
                          await waitForNativeWindowBounds(appliedBounds);
                      }
                  } catch (e) {
                      console.warn('Failed to prepare remembered normal window bounds', e);
                  }
              }
              if (cancelled) return;
              markStartupWindowRestorePending(startupRestoreGraceMs);
              applyStartupWindowChrome(1);
              return;
          }

          // Without a remembered maximised state, restore the last normal bounds.
          markStartupWindowRestorePending(startupRestoreGraceMs);
          const viewport = readCurrentVisibleViewport();
          try {
              if (!bounds || bounds.width < 400 || bounds.height < 300) {
                  if (isWindowsPlatform()) {
                      const nextBounds = resolveDefaultStartupWindowBounds(viewport);
                      await restoreNormalWindowBounds(nextBounds, layout);
                      void emitWindowDiagnostic('adjust:startup-default-window-bounds', {
                          to: nextBounds,
                      });
                  } else {
                      state.setWindowState('normal');
                  }
                  return;
              }
              await restoreNormalWindowBounds(bounds, layout);
          } catch (e) {
              console.warn('Failed to restore window bounds', e);
          } finally {
              clearStartupWindowRestorePending();
              markStartupWindowGeometrySettled();
          }
      };

      if (useStore.persist.hasHydrated()) {
          void restoreWindowState();
      }
      const unsubscribeHydration = useStore.persist.onFinishHydration(() => {
          if (cancelled) {
              return;
          }
          // hydration 完成后再恢复，确保读到启动最大化偏好与 windowBounds。
          restoredOnce = false;
          void restoreWindowState();
      });

      return () => {
          cancelled = true;
          if (startupWindowTimer !== null) {
              window.clearTimeout(startupWindowTimer);
          }
          unsubscribeHydration();
      };
  }, []);

  // 定时保存窗口状态、尺寸与位置
  useEffect(() => {
      let cancelled = false;
      let hydrated = useStore.persist.hasHydrated();
      let eventSaveTimer: number | null = null;
      let boundsRepairTimer: number | null = null;
      let lastSaved = '';

      const saveWindowState = async () => {
          if (cancelled || !hydrated || isStartupWindowRestorePending()) {
              return;
          }
          try {
              const [isFs, isMax] = await Promise.all([
                  safeWindowRuntimeCall(() => WindowIsFullscreen(), false),
                  safeWindowRuntimeCall(() => WindowIsMaximised(), false),
              ]);

              // 启动窗口恢复尚未 settle 时，不保存中间态和中间尺寸。
              if (isStartupWindowRestorePending()) {
                  return;
              }

              // 保存窗口状态
              const store = useStore.getState();
              const newState = isFs ? 'fullscreen' : (isMax ? 'maximized' : 'normal');
              if (store.windowState !== newState) {
                  void emitWindowDiagnostic('transition:windowState', {
                      from: store.windowState,
                      to: newState,
                  });
                  store.setWindowState(newState);
              }

              // Windows 最大化时只记录所在显示器：不把最大化尺寸写成普通窗口的还原尺寸。
              if (isFs || isMax) {
                  if (isWindowsPlatform() && isMax && !isFs) {
                      const layout = await loadMainWindowDisplayLayout();
                      if (cancelled || isStartupWindowRestorePending()) return;
                      const nextBounds = resolveMaximisedWindowRestoreBounds(store.windowBounds, layout);
                      if (nextBounds) {
                          lastSaved = `${nextBounds.width},${nextBounds.height},${nextBounds.x},${nextBounds.y},${nextBounds.dpi || ''}`;
                          store.setWindowBounds(nextBounds);
                      }
                  }
                  return;
              }

              const [size, pos] = await Promise.all([
                  safeWindowRuntimeCall(() => WindowGetSize(), null),
                  safeWindowRuntimeCall(() => WindowGetPosition(), null),
              ]);
              if (!size || !pos || isStartupWindowRestorePending()) return;
              const w = Math.trunc(Number(size.w || 0));
              const h = Math.trunc(Number(size.h || 0));
              const x = Math.trunc(Number(pos.x || 0));
              const y = Math.trunc(Number(pos.y || 0));
               if (w < 400 || h < 300) return;

               // macOS 的 WindowGetPosition 是当前屏局部坐标，必须换算成全局坐标
               // 才能记住窗口在哪块显示器上；换算失败时按原值保存，行为不回退。
               const layout = await loadMainWindowDisplayLayout();
               const savedBounds = resolveGlobalWindowBounds(
                   { width: w, height: h, x, y },
                   layout,
               ) ?? { width: w, height: h, x, y };

               const key = `${savedBounds.width},${savedBounds.height},${savedBounds.x},${savedBounds.y},${savedBounds.dpi || ''}`;
               if (key === lastSaved) return;
               lastSaved = key;
               if (Math.abs(savedBounds.x) > 5000 || Math.abs(savedBounds.y) > 5000) {
                   void emitWindowDiagnostic('anomaly:windowBounds', savedBounds);
               }
               store.setWindowBounds(savedBounds);
            } catch (e) {
                // 静默忽略
            }
      };
      captureMainWindowStateRef.current = saveWindowState;

      const scheduleWindowStateSave = (delayMs = 120) => {
          if (cancelled || !hydrated) {
              return;
          }
          if (eventSaveTimer !== null) {
              window.clearTimeout(eventSaveTimer);
          }
          eventSaveTimer = window.setTimeout(() => {
              eventSaveTimer = null;
              void saveWindowState();
          }, delayMs);
      };

      const repairRuntimeWindowBounds = async () => {
          if (cancelled || !hydrated) {
              return;
          }
          // 启动窗口恢复期间不要抢跑普通 bounds 校正。
          if (isStartupWindowRestorePending()) {
              return;
          }
          try {
              const [isFs, isMax] = await Promise.all([
                  safeWindowRuntimeCall(() => WindowIsFullscreen(), false),
                  safeWindowRuntimeCall(() => WindowIsMaximised(), false),
              ]);
              if (isFs || isMax) {
                  return;
              }
              const [size, pos] = await Promise.all([
                  safeWindowRuntimeCall(() => WindowGetSize(), null),
                  safeWindowRuntimeCall(() => WindowGetPosition(), null),
              ]);
              if (!size || !pos) {
                  return;
              }
              const currentBounds = {
                  width: Math.trunc(Number(size.w || 0)),
                  height: Math.trunc(Number(size.h || 0)),
                  x: Math.trunc(Number(pos.x || 0)),
                  y: Math.trunc(Number(pos.y || 0)),
              };
              if (currentBounds.width <= 0 || currentBounds.height <= 0) {
                  return;
              }
              const layout = await loadMainWindowDisplayLayout();
              if (cancelled || isStartupWindowRestorePending()) return;
              const placement = resolveRuntimeWindowPlacement(currentBounds, layout, readCurrentVisibleViewport(), isWindowsPlatform());
              if (!placement) return;
              const nextBounds = placement.bounds;
              const resolvedOriginal = resolveGlobalWindowBounds(currentBounds, layout);
              const originalGlobal = resolvedOriginal ?? currentBounds;
              const originalDpi = resolvedOriginal?.dpi;
              if (
                  nextBounds.x === originalGlobal.x &&
                  nextBounds.y === originalGlobal.y &&
                  nextBounds.width === originalGlobal.width &&
                  nextBounds.height === originalGlobal.height &&
                  nextBounds.dpi === originalDpi
              ) {
                  return;
              }
              void emitWindowDiagnostic('adjust:runtime-window-bounds', {
                  from: currentBounds,
                  to: nextBounds,
              });
              applyRuntimeWindowPlacement(placement, isWindowsPlatform(), WindowSetSize, WindowSetPosition);
              // 持久化用全局坐标：macOS 的窗口位置是当前屏局部坐标，直接落盘会丢
              // 失“在哪块显示器上”的信息。换算失败时保留设备侧坐标，行为不回退。
              const persistedBounds = placement.persistedBounds;
              lastSaved = `${persistedBounds.width},${persistedBounds.height},${persistedBounds.x},${persistedBounds.y},${persistedBounds.dpi || ''}`;
              useStore.getState().setWindowBounds(persistedBounds);
              window.dispatchEvent(new Event('resize'));
          } catch {
              // Wails runtime window APIs are best-effort here.
          }
      };

      const scheduleWindowBoundsRepair = (delayMs = 80) => {
          if (cancelled || !hydrated) {
              return;
          }
          if (boundsRepairTimer !== null) {
              window.clearTimeout(boundsRepairTimer);
          }
          boundsRepairTimer = window.setTimeout(() => {
              boundsRepairTimer = null;
              void repairRuntimeWindowBounds();
          }, delayMs);
      };

      const handleWindowRuntimeChange = () => {
          scheduleWindowBoundsRepair();
          scheduleWindowStateSave(260);
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              scheduleWindowBoundsRepair();
              scheduleWindowStateSave(260);
          }
      };

      const handleWindowLifecycleFlush = () => {
          void saveWindowState();
      };

      if (hydrated) {
          scheduleWindowBoundsRepair(360);
          scheduleWindowStateSave(320);
      }
      const unsubscribeHydration = useStore.persist.onFinishHydration(() => {
          if (cancelled || hydrated) {
              return;
          }
          hydrated = true;
          scheduleWindowBoundsRepair(360);
          scheduleWindowStateSave(320);
      });

      const cleanupWindowActivityScheduler = installNativeWindowActivityScheduler({
          windowTarget: window,
          documentTarget: document,
          fallbackIntervalMs: WINDOW_STATE_FALLBACK_INTERVAL_MS,
          onFallback: () => {
              void saveWindowState();
          },
          handlers: {
              // resize 过程中只保存状态,不执行 bounds 修复——修复内的 WindowSetSize 会与
              // 用户拖拽互相打架(程序化改窗→再触发 resize→循环抖动);静止 300ms 后再修。
              resize: () => {
                  scheduleWindowBoundsRepair(300);
                  scheduleWindowStateSave(260);
              },
              focus: handleWindowRuntimeChange,
              pageshow: handleWindowRuntimeChange,
              pagehide: handleWindowLifecycleFlush,
              beforeunload: handleWindowLifecycleFlush,
              visibilitychange: handleVisibilityChange,
          },
      });
      return () => {
          cancelled = true;
          if (captureMainWindowStateRef.current === saveWindowState) {
              captureMainWindowStateRef.current = async () => undefined;
          }
          if (eventSaveTimer !== null) {
              window.clearTimeout(eventSaveTimer);
          }
          if (boundsRepairTimer !== null) {
              window.clearTimeout(boundsRepairTimer);
          }
          cleanupWindowActivityScheduler();
          unsubscribeHydration();
      };
  }, []);

  useEffect(() => {
      if (!isWindowsPlatform()) {
          return;
      }

      let cancelled = false;
      let inFlight = false;
      let lastRatio = Number(window.devicePixelRatio) || 1;
      let lastFixAt = 0;
      let activationTimer: number | null = null;
      let resizeTimer: number | null = null;
      let minimisedCheckTimer: number | null = null;
      let minimisedSeen = false;
      let hiddenSeen = document.visibilityState === 'hidden';

      // Automatic scale-fix may call ResetWebViewZoom multiple times on startup.
      // The backend path depends on Wails unexported fields and can fail harmlessly;
      // log at most once so the console is not flooded with expected unavailability.
      let resetWebViewZoomUnavailableLogged = false;
      const tryResetWebViewZoomQuietly = async () => {
          try {
              const res = await (window as any).go?.app?.App?.ResetWebViewZoom?.();
              if (res?.success) {
                  return true;
              }
              if (!resetWebViewZoomUnavailableLogged) {
                  resetWebViewZoomUnavailableLogged = true;
                  console.warn('ResetWebViewZoom unavailable in fixWindowScaleIfNeeded:', res?.message);
              }
              return false;
          } catch (e) {
              if (!resetWebViewZoomUnavailableLogged) {
                  resetWebViewZoomUnavailableLogged = true;
                  console.warn('ResetWebViewZoom call failed in fixWindowScaleIfNeeded', e);
              }
              return false;
          }
      };

      let refreshWebViewBoundsUnavailableLogged = false;
      const tryRefreshWebViewBoundsQuietly = async (): Promise<boolean> => {
          try {
              const result = await (window as any).go?.app?.App?.RefreshWebViewBounds?.();
              if (result?.success) return true;
              if (!refreshWebViewBoundsUnavailableLogged) {
                  refreshWebViewBoundsUnavailableLogged = true;
                  console.warn('RefreshWebViewBounds unavailable in scale repair:', result?.message);
              }
          } catch (error) {
              if (!refreshWebViewBoundsUnavailableLogged) {
                  refreshWebViewBoundsUnavailableLogged = true;
                  console.warn('RefreshWebViewBounds call failed in scale repair', error);
              }
          }
          return false;
      };

      const fixWindowScaleIfNeeded = async (reason: WindowScaleFixReason) => {
          if (cancelled || inFlight) return;
          const now = Date.now();
          if (now - lastFixAt < 700) return;
          inFlight = true;
          try {
              await repairWindowsWindowScale({
                  reason,
                  readViewport: () => ({
                      innerWidth: window.innerWidth,
                      devicePixelRatio: Number(window.devicePixelRatio) || 1,
                      visualViewportScale: window.visualViewport?.scale,
                  }),
                  resetZoom: tryResetWebViewZoomQuietly,
                  refreshBounds: tryRefreshWebViewBoundsQuietly,
                  notifyResize: () => window.dispatchEvent(new Event('resize')),
                  isCancelled: () => cancelled,
              });
              lastFixAt = Date.now();
          } catch (error) {
              console.warn('Wails Window APIs unavailable in scale repair', error);
          } finally {
              inFlight = false;
          }
      };

      const rememberMinimisedState = async (): Promise<boolean> => {
          if (cancelled) return false;
          const isMinimised = await safeWindowRuntimeCall(() => WindowIsMinimised(), false);
          if (isMinimised) {
              minimisedSeen = true;
          }
          return isMinimised;
      };

      const rememberMinimisedStateSoon = () => {
          if (minimisedCheckTimer !== null) {
              window.clearTimeout(minimisedCheckTimer);
          }
          minimisedCheckTimer = window.setTimeout(() => {
              minimisedCheckTimer = null;
              if (cancelled) return;
              void rememberMinimisedState();
          }, 120);
      };

      const checkDevicePixelRatio = () => {
          if (cancelled) return;
          const currentRatio = Number(window.devicePixelRatio) || 1;
          if (Math.abs(currentRatio - lastRatio) < 0.02) {
              return;
          }
          lastRatio = currentRatio;
          if (minimisedSeen || hiddenSeen) {
              scheduleActivationFix();
              return;
          }
          void fixWindowScaleIfNeeded('ratio-change');
      };

      const scheduleDevicePixelRatioCheck = (trigger: WindowsScaleCheckTrigger) => {
          if (cancelled) return;
          const delayMs = resolveWindowsScaleCheckDelayMs(trigger);
          if (delayMs <= 0) {
              checkDevicePixelRatio();
              return;
          }

          if (resizeTimer !== null) {
              window.clearTimeout(resizeTimer);
          }
          resizeTimer = window.setTimeout(() => {
              resizeTimer = null;
              if (cancelled) return;
              checkDevicePixelRatio();
          }, delayMs);
      };

      const scheduleActivationFix = () => {
          if (cancelled) return;
          if (activationTimer !== null) {
              window.clearTimeout(activationTimer);
          }
          const delayMs = (minimisedSeen || hiddenSeen) ? 260 : 80;
          activationTimer = window.setTimeout(async () => {
              activationTimer = null;
              if (cancelled) return;
              if (await rememberMinimisedState()) {
                  return;
              }
              const reason: WindowScaleFixReason = (minimisedSeen || hiddenSeen) ? 'restore' : 'activation';
              minimisedSeen = false;
              hiddenSeen = false;
              void fixWindowScaleIfNeeded(reason);
          }, delayMs);
      };

      const handleWindowFocus = () => {
          if (cancelled) return;
          scheduleDevicePixelRatioCheck('focus');
          scheduleActivationFix();
      };

      const handleWindowBlur = () => {
          if (cancelled) return;
          if (document.visibilityState === 'hidden') {
              hiddenSeen = true;
          }
          rememberMinimisedStateSoon();
      };

      const handleVisibilityChange = () => {
          if (cancelled) return;
          if (document.visibilityState !== 'visible') {
              hiddenSeen = true;
              rememberMinimisedStateSoon();
              return;
          }
          scheduleDevicePixelRatioCheck('visibilitychange');
          scheduleActivationFix();
      };

      const handlePageShow = () => {
          if (cancelled) return;
          scheduleDevicePixelRatioCheck('pageshow');
          scheduleActivationFix();
      };

      const handleWindowResize = () => {
          rememberMinimisedStateSoon();
          scheduleDevicePixelRatioCheck('resize');
      };

      // Windows 冷启动：WebView2 首次布局常只铺满左上角一部分，任务栏恢复才会走 restore 修复。
      // 这里在启动后主动按 startup 原因做几次轻量 settle，避免用户必须双击任务栏。
      // 间隔需大于 fixWindowScaleIfNeeded 的 700ms 节流，确保多次都能真正执行。
      const startupLayoutFixTimers = [220, 1000, 1900].map((delayMs) => (
          window.setTimeout(() => {
              if (cancelled) return;
              void fixWindowScaleIfNeeded('startup');
          }, delayMs)
      ));
      const cleanupWindowActivityScheduler = installNativeWindowActivityScheduler({
          windowTarget: window,
          documentTarget: document,
          fallbackIntervalMs: WINDOWS_SCALE_FALLBACK_INTERVAL_MS,
          onFallback: () => {
              void rememberMinimisedState();
              checkDevicePixelRatio();
          },
          handlers: {
              resize: handleWindowResize,
              focus: handleWindowFocus,
              blur: handleWindowBlur,
              pageshow: handlePageShow,
              visibilitychange: handleVisibilityChange,
          },
      });
      // 拖拽缩放防闪标记：挂 data-window-resizing 供 CSS 做不透明兜底与禁过渡（App.css）。
      // 不做 RefreshWebViewBounds 追帧——wails 内建 Resize 已在 WM_SIZE 同步执行，
      // 追帧是冗余的第二次 PutBounds，与内建调用竞争反而加重抖动。
      const cleanupWindowResizeFollow = installWindowResizeActivityMarker({
          windowTarget: window,
          documentTarget: document,
      });
      // 最大化快速标记：圆角/裁剪与窗口几何同帧切换，消除边缘形态二次变化（App.css）。
      const cleanupWindowMaximizedFollow = installWindowMaximizedFastMarker({
          windowTarget: window,
          documentTarget: document,
      });

      return () => {
          cancelled = true;
          if (activationTimer !== null) {
              window.clearTimeout(activationTimer);
          }
          if (resizeTimer !== null) {
              window.clearTimeout(resizeTimer);
          }
          if (minimisedCheckTimer !== null) {
              window.clearTimeout(minimisedCheckTimer);
              minimisedCheckTimer = null;
          }
          for (const timer of startupLayoutFixTimers) {
              window.clearTimeout(timer);
          }
          cleanupWindowActivityScheduler();
          cleanupWindowResizeFollow();
          cleanupWindowMaximizedFollow();
      };
  }, []);

  const {
      bgContent,
      floatingLogButtonBgColor, floatingLogButtonBorderColor, floatingLogButtonShadow, floatingLogButtonTextColor,
      isSidebarNarrow, isSidebarUltraCompact,
      overlayTheme, renderUtilityModalTitle,
      sidebarHorizontalPadding,
      toolCenterContentPanelStyle, toolCenterDetailBodyStyle, toolCenterDetailPanelStyle,
      toolCenterModalSplitStyle, toolCenterModalWorkspaceStyle,
      toolCenterNavPanelStyle, utilityButtonStyle,
      utilityModalShellStyle, utilityMutedTextStyle, utilityPanelStyle,
  } = useAppUtilityStyles({
      blurFilter,
      darkMode,
      effectiveOpacity,
      effectiveUiScale,
      resolvedAppearance,
      sidebarWidth,
  });

  const addTab = useStore(state => state.addTab);
  const connections = useStore(state => state.connections);
  const tabs = useWorkbenchTabs();
  const activeTabId = useStore(state => state.activeTabId);
  const setActiveTab = useStore(state => state.setActiveTab);
  const activeWorkbenchTab = useMemo(
      () => activeTabId ? tabs.find(tab => tab.id === activeTabId) : undefined,
      [activeTabId, tabs],
  );
  const applicationQuitConfirmRef = useRef<{ destroy: () => void } | null>(null);
  const applicationQuitHandlingRef = useRef(false);
  const useNativeMacWindowControls = isMacRuntime;
  const activeShortcutPlatform = getShortcutPlatform(isMacRuntime);
  const macWindowDiagnosticsEnabled = shouldEnableMacWindowDiagnostics(
      isMacRuntime,
      import.meta.env.DEV,
      import.meta.env.VITE_GONAVI_ENABLE_MAC_WINDOW_DIAGNOSTICS,
  );
  useEffect(() => {
      return installGlobalImeCompositionTracking(window, document);
  }, []);
  // 启动发现更新时打开设置中心「关于」页（由 useAppUpdateManager 通过 bridge 调用）
  const updateCenterBridgeRef = useRef<{
      open: () => void;
      close: () => void;
      isOpen: () => boolean;
  } | null>(null);
  // 手动「检查更新」发现新版本时，由 useAppUpdateManager 触发打开更新日志弹窗
  const openReleaseNotesOnManualCheckRef = useRef<(() => void) | null>(null);
  const {
      aboutDisplayVersion,
      aboutInfo,
      aboutLoading,
      aboutUpdateStatus,
      canShowProgressEntry,
      changeUpdateChannel,
      checkForUpdates,
      downloadUpdate,
      formatBytes,
      handleInstallFromProgress,
      hideUpdateDownloadProgress,
      isBackgroundProgressForLatestUpdate,
      isCheckingForUpdates,
      isLatestUpdateDownloaded,
      isUpdateChannelLoading,
      isUpdateChannelSaving,
      installMode,
      lastUpdateInfo,
      markUpdateProgressDismissed,
      muteLatestUpdate,
      openDownloadedUpdateDirectory,
      prepareAboutSurface,
      showUpdateDownloadProgress,
      updateChannel,
      updateDownloadProgress,
      updateInstallAction,
  } = useAppUpdateManager({
      runtimeBuildType,
      t,
      updateCenterBridgeRef,
      onManualCheckHasUpdateRef: openReleaseNotesOnManualCheckRef,
  });
  const [aboutLastCheckedAt, setAboutLastCheckedAt] = useState('');
  const [releaseNotesModalOpen, setReleaseNotesModalOpen] = useState(false);
  const [releaseNotesReadTick, setReleaseNotesReadTick] = useState(0);
  useEffect(() => {
      if (!lastUpdateInfo) {
          return;
      }
      setAboutLastCheckedAt(formatAboutCheckedAt(new Date()));
  }, [
      lastUpdateInfo?.channel,
      lastUpdateInfo?.currentVersion,
      lastUpdateInfo?.hasUpdate,
      lastUpdateInfo?.latestVersion,
  ]);

  const releaseNotesReadKey = useMemo(
      () => buildReleaseNotesReadKey(lastUpdateInfo),
      [lastUpdateInfo?.channel, lastUpdateInfo?.latestVersion],
  );
  // releaseNotesReadTick 强制在 mark 后重算未读态
  const hasUnreadReleaseNotes = useMemo(() => {
      void releaseNotesReadTick;
      if (!lastUpdateInfo || !releaseNotesReadKey) return false;
      // 有正文或至少有 GitHub 链接时，未读才有提示意义
      if (!String(lastUpdateInfo.releaseNotes || '').trim() && !String(lastUpdateInfo.releaseNotesUrl || '').trim()) {
          return false;
      }
      return !isReleaseNotesRead(releaseNotesReadKey);
  }, [lastUpdateInfo, releaseNotesReadKey, releaseNotesReadTick]);

  const openReleaseNotesModal = useCallback(() => {
      if (!lastUpdateInfo) return;
      setReleaseNotesModalOpen(true);
  }, [lastUpdateInfo]);

  const closeReleaseNotesModal = useCallback(() => {
      setReleaseNotesModalOpen(false);
      hideUpdateDownloadProgress();
  }, [hideUpdateDownloadProgress]);

  const handleReleaseNotesModalOpen = useCallback(() => {
      if (!releaseNotesReadKey) return;
      if (markReleaseNotesRead(releaseNotesReadKey)) {
          setReleaseNotesReadTick((value) => value + 1);
      }
  }, [releaseNotesReadKey]);

  /** 下载与更新日志同窗：点下载即打开弹窗并开始下载 */
  const handleDownloadUpdateWithNotes = useCallback(() => {
      if (!lastUpdateInfo) return;
      setReleaseNotesModalOpen(true);
      void downloadUpdate(lastUpdateInfo, false);
  }, [downloadUpdate, lastUpdateInfo]);

  const releaseNotesModalVisible = releaseNotesModalOpen || updateDownloadProgress.open;

  const emitWindowDiagnostic = useCallback(async (stage: string, extra: Record<string, unknown> = {}) => {
      if (!macWindowDiagnosticsEnabled) {
          return;
      }
      const backendApp = (window as any).go?.app?.App;
      if (typeof backendApp?.LogWindowDiagnostic !== 'function') {
          return;
      }
      try {
          const [isFullscreen, isMaximised, isMinimised, isNormal, size, position] = await Promise.all([
              safeWindowRuntimeCall(() => WindowIsFullscreen(), false),
              safeWindowRuntimeCall(() => WindowIsMaximised(), false),
              safeWindowRuntimeCall(() => WindowIsMinimised(), false),
              safeWindowRuntimeCall(() => WindowIsNormal(), false),
              safeWindowRuntimeCall(() => WindowGetSize(), null),
              safeWindowRuntimeCall(() => WindowGetPosition(), null),
          ]);
          const payload = {
              seq: ++windowDiagSequenceRef.current,
              ts: new Date().toISOString(),
              stage,
              nativeControls: useNativeMacWindowControls,
              documentVisible: document.visibilityState,
              documentHasFocus: document.hasFocus(),
              devicePixelRatio: Number(window.devicePixelRatio) || 1,
              windowState: {
                  isFullscreen,
                  isMaximised,
                  isMinimised,
                  isNormal,
              },
              size: size ? { w: Math.trunc(Number(size.w || 0)), h: Math.trunc(Number(size.h || 0)) } : null,
              position: position ? { x: Math.trunc(Number(position.x || 0)), y: Math.trunc(Number(position.y || 0)) } : null,
              extra,
          };
          const signature = JSON.stringify({
              stage,
              nativeControls: payload.nativeControls,
              visible: payload.documentVisible,
              focus: payload.documentHasFocus,
              state: payload.windowState,
              size: payload.size,
              position: payload.position,
              extra,
          });
          const now = Date.now();
          if (signature === windowDiagLastSignatureRef.current && now-windowDiagLastAtRef.current < 250) {
              return;
          }
          windowDiagLastSignatureRef.current = signature;
          windowDiagLastAtRef.current = now;
          await backendApp.LogWindowDiagnostic(stage, JSON.stringify(payload));
      } catch (error) {
          console.warn('Failed to emit window diagnostic', error);
      }
  }, [macWindowDiagnosticsEnabled, useNativeMacWindowControls]);

  useEffect(() => {
      if (!macWindowDiagnosticsEnabled) {
          return;
      }

      let cancelled = false;
      let pollTimer: number | null = null;
      let burstTimer: number | null = null;

      const stopBurst = () => {
          if (pollTimer !== null) {
              window.clearInterval(pollTimer);
              pollTimer = null;
          }
          if (burstTimer !== null) {
              window.clearTimeout(burstTimer);
              burstTimer = null;
          }
      };

      const startBurst = (reason: string, extra: Record<string, unknown> = {}) => {
          if (cancelled) {
              return;
          }
          void emitWindowDiagnostic(`burst:start:${reason}`, extra);
          if (pollTimer === null) {
              pollTimer = window.setInterval(() => {
                  void emitWindowDiagnostic(`burst:tick:${reason}`);
              }, 250);
          }
          if (burstTimer !== null) {
              window.clearTimeout(burstTimer);
          }
          burstTimer = window.setTimeout(() => {
              stopBurst();
              void emitWindowDiagnostic(`burst:stop:${reason}`);
          }, 6000);
      };

      const handleFocus = () => {
          void emitWindowDiagnostic('event:focus');
      };
      const handleBlur = () => {
          void emitWindowDiagnostic('event:blur');
      };
      const handleResize = () => {
          void emitWindowDiagnostic('event:resize');
      };
      const handleVisibilityChange = () => {
          void emitWindowDiagnostic('event:visibilitychange', { visibility: document.visibilityState });
      };
      const handleEditableKeydown = (event: KeyboardEvent) => {
          if (!isEditableElement(event.target)) {
              return;
          }
          const key = String(event.key || '');
          const maybeFullscreenKey = key === 'Escape' || key.toLowerCase() === 'f' || key === 'Process';
          const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
          startBurst('editable-keydown', {
              key,
              code: String(event.code || ''),
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              altKey: event.altKey,
              shiftKey: event.shiftKey,
              maybeFullscreenKey,
              hasModifier,
          });
      };
      const handleCompositionStart = () => {
          startBurst('compositionstart');
      };
      const handleCompositionEnd = () => {
          startBurst('compositionend');
      };

      void emitWindowDiagnostic('session:start');
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('resize', handleResize);
      window.addEventListener('keydown', handleEditableKeydown, true);
      window.addEventListener('compositionstart', handleCompositionStart, true);
      window.addEventListener('compositionend', handleCompositionEnd, true);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
          cancelled = true;
          stopBurst();
          window.removeEventListener('focus', handleFocus);
          window.removeEventListener('blur', handleBlur);
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('keydown', handleEditableKeydown, true);
          window.removeEventListener('compositionstart', handleCompositionStart, true);
          window.removeEventListener('compositionend', handleCompositionEnd, true);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [emitWindowDiagnostic, macWindowDiagnosticsEnabled]);

  const switchActiveTabByOffset = useCallback((offset: 1 | -1) => {
      if (tabs.length < 2) return;
      const activeIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const baseIndex = activeIndex >= 0 ? activeIndex : 0;
      const nextIndex = (baseIndex + offset + tabs.length) % tabs.length;
      setActiveTab(tabs[nextIndex].id);
  }, [activeTabId, setActiveTab, tabs]);

  const resetApplicationQuitRequest = useCallback(() => {
      applicationQuitHandlingRef.current = false;
      applicationQuitConfirmRef.current = null;
      void CancelApplicationQuit();
  }, []);

  const forceQuitApplication = useCallback(async () => {
      const res = await ForceQuitApplication();
      if (res && res.success === false) {
          throw new Error(res.message || t('common.unknown'));
      }
  }, [t]);

  const restartApplication = useCallback(async (): Promise<boolean> => {
      const res = await RestartApplication();
      if (res && res.success === false) {
          throw new Error(res.message || t('common.unknown'));
      }
      return true;
  }, [t]);

  const handleApplicationQuitRequest = useCallback(async (
      confirmedAction?: ApplicationQuitConfirmedAction,
      cancelledAction?: () => void,
  ) => {
      if (applicationQuitHandlingRef.current) {
          return;
      }
      applicationQuitHandlingRef.current = true;

      const cancelRequest = () => {
          resetApplicationQuitRequest();
          cancelledAction?.();
      };

      const runConfirmedAction = async (): Promise<boolean> => {
          let accepted = false;
          try {
              await prepareApplicationQuitPersistence({
                  captureWindowState: () => captureMainWindowStateRef.current(),
                  flushDrafts: async () => undefined,
                  flushAppState: async () => {
                      await flushAppStatePersistence();
                  },
              });
              if (confirmedAction) {
                  accepted = await confirmedAction();
              } else {
                  await forceQuitApplication();
                  accepted = true;
              }
          } catch (error) {
              cancelRequest();
              message.error(t('app.quit.message.quit_failed', {
                  detail: error instanceof Error ? error.message : String(error),
              }));
              return false;
          }
          if (!accepted) {
              cancelRequest();
          }
          return accepted;
      };

      await runConfirmedAction();
  }, [forceQuitApplication, resetApplicationQuitRequest, t]);


  const handleInstallUpdateRequest = useCallback(async () => {
      let pendingCloseInstanceCount: number | null = null;
      hideUpdateDownloadProgress();
      await handleApplicationQuitRequest(
          () => handleInstallFromProgress(false, (instanceCount) => {
              pendingCloseInstanceCount = instanceCount;
          }),
          () => {
              if (pendingCloseInstanceCount === null) {
                  showUpdateDownloadProgress();
              }
          },
      );
      if (pendingCloseInstanceCount === null) {
          return;
      }
      Modal.confirm({
          title: t('app.about.update_install_confirm.close_instances_title', { count: pendingCloseInstanceCount }),
          content: t('app.about.update_install_confirm.close_instances_content'),
          okText: t('app.about.update_install_confirm.close_instances_ok'),
          cancelText: t('common.cancel'),
          centered: true,
          closable: true,
          maskClosable: false,
          zIndex: applicationQuitModalZIndex,
          okButtonProps: { danger: true, type: 'primary' },
          onCancel: () => {
              showUpdateDownloadProgress();
          },
          onOk: async () => {
              await handleInstallFromProgress(true);
          },
      });
  }, [applicationQuitModalZIndex, handleApplicationQuitRequest, handleInstallFromProgress, hideUpdateDownloadProgress, showUpdateDownloadProgress, t]);

  useEffect(() => {
      const offBeforeClose = EventsOn('app:before-close-request', () => {
          void handleApplicationQuitRequest();
      });
      return () => {
          offBeforeClose();
      };
  }, [handleApplicationQuitRequest]);

  const [toolCenterBackGroupKey, setToolCenterBackGroupKey] = useState<ToolCenterGroupKey | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  type ThemeSettingsSection = 'theme' | 'appearance';
  const THEME_SETTINGS_SECTION_STORAGE_KEY = 'gonavi.themeSettingsSection';
  const sanitizeThemeSettingsSection = useCallback((value: unknown): ThemeSettingsSection => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'appearance') {
          return normalized;
      }
      return 'theme';
  }, []);
  const [themeModalSection, setThemeModalSection] = useState<ThemeSettingsSection>(() => {
      try {
          return sanitizeThemeSettingsSection(window.localStorage.getItem(THEME_SETTINGS_SECTION_STORAGE_KEY));
      } catch {
          return 'theme';
      }
  });
  useEffect(() => {
      try {
          window.localStorage.setItem(THEME_SETTINGS_SECTION_STORAGE_KEY, themeModalSection);
      } catch {
          // ignore persistence failures
      }
  }, [themeModalSection]);
  const [isLinuxCJKFontBannerDismissed, setIsLinuxCJKFontBannerDismissed] = useState(false);
  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);
  const closeShortcutScopeRef = useRef<CloseShortcutScope>('workspace');
  const isThemeSettingsPaneOpen = activeSettingsCenterPane?.key === 'theme';
  useEffect(() => {
      const shouldLoadInstalledFonts =
          runtimePlatform === 'linux' || ((isThemeModalOpen || isThemeSettingsPaneOpen) && themeModalSection === 'appearance');
      if (!shouldLoadInstalledFonts) {
          return;
      }
      if (hasLoadedInstalledFontsRef.current || isFontFamiliesLoading) {
          return;
      }

      let cancelled = false;
      hasLoadedInstalledFontsRef.current = true;
      setIsFontFamiliesLoading(true);
      setFontFamiliesLoadError(null);

      ListInstalledFontFamilies()
          .then((result) => {
              if (cancelled) {
                  return;
              }
              if (!result?.success) {
                  throw new Error(String(result?.message || t('app.theme.font_family.load_failed')));
              }
              const nextFonts = Array.isArray(result?.data)
                  ? result.data
                      .map((item) => ({
                          family: sanitizeFontFamilyInput((item as InstalledFontFamily | Record<string, unknown>)?.family) || '',
                          path: typeof (item as InstalledFontFamily | Record<string, unknown>)?.path === 'string'
                              ? String((item as InstalledFontFamily | Record<string, unknown>).path)
                              : undefined,
                      }))
                      .filter((item) => item.family)
                  : EMPTY_INSTALLED_FONT_FAMILIES;
              setInstalledFontFamilies(nextFonts);
          })
          .catch((error) => {
              if (cancelled) {
                  return;
              }
              hasLoadedInstalledFontsRef.current = false;
              setFontFamiliesLoadError(String(error instanceof Error ? error.message : error || t('app.theme.font_family.load_failed')));
          })
          .finally(() => {
              if (!cancelled) {
                  setIsFontFamiliesLoading(false);
              }
          });

      return () => {
          cancelled = true;
      };
  }, [isThemeModalOpen, isThemeSettingsPaneOpen, runtimePlatform, t, themeModalSection]);


  const [isDataRootModalOpen, setIsDataRootModalOpen] = useState(false);
  const [dataRootInfo, setDataRootInfo] = useState<any>(null);
  const [selectedDataRootPath, setSelectedDataRootPath] = useState('');
  const [dataRootLoading, setDataRootLoading] = useState(false);
  const [dataRootApplying, setDataRootApplying] = useState(false);
  const [servyEngineConfig, setServyEngineConfig] = useState<any>(null);
  const [servyEnginePathDraft, setServyEnginePathDraft] = useState('');
  const [servyEngineApplying, setServyEngineApplying] = useState(false);
  const directorySettingsApplying = dataRootApplying;

  const handleOpenToolsModal = useCallback((group: ToolCenterGroupKey = 'config') => {
      setToolCenterBackGroupKey(null);
      setActiveSettingsCenterGroupKey(group);
      setActiveSettingsCenterPane(resolveSettingsCenterGroupInitialPane(group));
      openSettingsCenterWorkbenchTab();
  }, [openSettingsCenterWorkbenchTab]);
  const handleOpenSettingsModal = useCallback((group: SettingsCenterGroupKey = 'preferences') => {
      setActiveSettingsCenterGroupKey(group);
      setActiveSettingsCenterPane(resolveSettingsCenterGroupInitialPane(group));
      openSettingsCenterWorkbenchTab();
  }, [openSettingsCenterWorkbenchTab]);
  const handleOpenSettingsCenterPane = useCallback((group: SettingsCenterGroupKey, key: SettingsCenterPaneKey) => {
      setActiveSettingsCenterGroupKey(group);
      setActiveSettingsCenterPane({ key, group });
      openSettingsCenterWorkbenchTab();
  }, [openSettingsCenterWorkbenchTab]);
  const handleCancelSettingsCenterPane = useCallback(() => {
      setToolCenterBackGroupKey(null);
      setActiveSettingsCenterPane(null);
      closeSettingsCenterWorkbenchTab();
  }, [closeSettingsCenterWorkbenchTab]);
  const isSettingsAboutPaneOpen = isSettingsModalOpen && activeSettingsCenterPane?.key === 'about-go-navi';
  const wasSettingsCenterTabOpenRef = useRef(false);
  useEffect(() => {
      const wasOpen = wasSettingsCenterTabOpenRef.current;
      wasSettingsCenterTabOpenRef.current = isSettingsModalOpen;
      if (!wasOpen || isSettingsModalOpen) {
          return;
      }
      // Tab closed via workbench chrome (X) — mirror cancel cleanup without re-entering leave guard.
      setToolCenterBackGroupKey(null);
      setActiveSettingsCenterPane(null);
  }, [isSettingsModalOpen]);
  const isSettingsAboutPaneOpenRef = useRef(false);
  useEffect(() => {
      isSettingsAboutPaneOpenRef.current = isSettingsAboutPaneOpen;
  }, [isSettingsAboutPaneOpen]);
  useEffect(() => {
      updateCenterBridgeRef.current = {
          open: () => {
              handleOpenSettingsCenterPane('about', 'about-go-navi');
          },
          close: () => {
              handleCancelSettingsCenterPane();
          },
          isOpen: () => isSettingsAboutPaneOpenRef.current,
      };
      return () => {
          updateCenterBridgeRef.current = null;
      };
  }, [handleCancelSettingsCenterPane, handleOpenSettingsCenterPane]);
  useEffect(() => {
      openReleaseNotesOnManualCheckRef.current = () => {
          setReleaseNotesModalOpen(true);
      };
      return () => {
          openReleaseNotesOnManualCheckRef.current = null;
      };
  }, []);
  useEffect(() => {
      if (!isSettingsAboutPaneOpen) {
          return;
      }
      prepareAboutSurface();
  }, [isSettingsAboutPaneOpen, prepareAboutSurface]);
  const handleOpenToolCenterPane = useCallback((group: ToolCenterGroupKey, key: ToolCenterPaneKey) => {
      setToolCenterBackGroupKey(group);
      setActiveSettingsCenterGroupKey(group);
      setActiveSettingsCenterPane({ key, group });
      openSettingsCenterWorkbenchTab();
  }, []);
  /** 标题栏「数据目录」图标入口：直接落到工具中心的「应用数据目录」面板。 */
  const handleOpenDataRootPane = useCallback(() => {
      handleOpenToolCenterPane('config', 'data-root-application');
  }, [handleOpenToolCenterPane]);
  /** 服务日志保留天数：面板加载读取一次；切换选项即保存并带回清理数量反馈。 */
  const [logRetentionDays, setLogRetentionDays] = useState<number | null>(null);
  useEffect(() => {
      void GetServiceLogRetentionDays().then((result) => {
          if (result.success) {
              setLogRetentionDays(Number((result.data as { days?: number } | null)?.days ?? 7));
          }
      });
  }, []);
  const handleLogRetentionChange = useCallback((days: number) => {
      void SetServiceLogRetentionDays(days).then((result) => {
          if (!result.success) {
              message.error(result.message || t('app.data_root.log_retention.invalid'));
              return;
          }
          const removed = Number((result.data as { removed?: number } | null)?.removed ?? 0);
          setLogRetentionDays(days);
          message.success(removed > 0
              ? t('app.data_root.log_retention.saved', { count: removed })
              : t('app.data_root.log_retention.saved_none'));
      });
  }, [t]);
  /** Title-bar / explorer settings entries → settings center navigation. */
  const handleTitleBarSettingsNavigation = useCallback((spec: {
    group: 'preferences' | 'config' | 'about';
    pane?: string;
  }) => {
      if (!spec.pane) {
          if (isToolCenterGroupKey(spec.group)) {
              handleOpenToolsModal(spec.group);
              return;
          }
          handleOpenSettingsModal(spec.group);
          return;
      }
      if (isToolCenterGroupKey(spec.group)) {
          handleOpenToolCenterPane(spec.group, spec.pane as ToolCenterPaneKey);
          return;
      }
      if (spec.group === 'preferences' && spec.pane === 'theme') {
          setThemeModalSection('theme');
          handleOpenSettingsCenterPane('preferences', 'theme');
          return;
      }
      handleOpenSettingsCenterPane(spec.group, spec.pane as SettingsCenterPaneKey);
  }, [
      addTab,
      handleCancelSettingsCenterPane,
      handleOpenSettingsCenterPane,
      handleOpenSettingsModal,
      handleOpenToolCenterPane,
      handleOpenToolsModal,
  ]);
  const handleReturnToToolCenter = useCallback((closeChild?: () => void) => {
      const returnGroup = toolCenterBackGroupKey ?? 'config';
      closeChild?.();
      setToolCenterBackGroupKey(null);
      setActiveSettingsCenterGroupKey(returnGroup);
      setActiveSettingsCenterPane(resolveSettingsCenterGroupInitialPane(returnGroup));
      openSettingsCenterWorkbenchTab();
  }, [toolCenterBackGroupKey]);
  const handleFocusSidebarSearch = useCallback(() => {
      setIsSidebarCollapsed(false);
      window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('gonavi:focus-sidebar-search'));
      }, 0);
  }, []);
  const loadDataRootInfo = useCallback(async () => {
      setDataRootLoading(true);
      try {
          const res = await GetDataRootDirectoryInfo();
          if (!res?.success) {
              throw new Error(res?.message || t('app.data_root.message.load_failed'));
          }
          const data = (res?.data || {}) as any;
          setDataRootInfo(data);
          setSelectedDataRootPath(String(data.path || ''));
      } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error || t('common.unknown'));
          void message.error(t('app.data_root.message.load_failed_with_error', { error: errMsg }));
      } finally {
          setDataRootLoading(false);
      }
  }, [t]);

  useEffect(() => {
      if (!isDataRootModalOpen && !activeSettingsCenterPane?.key.startsWith('data-root')) {
          return;
      }
      void loadDataRootInfo();
  }, [activeSettingsCenterPane?.key, isDataRootModalOpen, loadDataRootInfo]);

  const handleSelectDataRoot = useCallback(async () => {
      try {
          const res = await SelectDataRootDirectory(selectedDataRootPath || dataRootInfo?.path || '');
          if (!res?.success) {
              if (String(res?.message || '') !== '已取消') {
                  throw new Error(res?.message || t('app.data_root.message.select_failed'));
              }
              return;
          }
          const data = (res?.data || {}) as any;
          setSelectedDataRootPath(String(data.path || ''));
      } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error || t('common.unknown'));
          void message.error(t('app.data_root.message.select_failed_with_error', { error: errMsg }));
      }
  }, [dataRootInfo?.path, selectedDataRootPath, t]);

  const handleApplyDataRoot = useCallback(async (migrate: boolean, useDefaultPath = false) => {
      const nextPath = useDefaultPath ? String(dataRootInfo?.defaultPath || '') : String(selectedDataRootPath || '').trim();
      if (!nextPath) {
          void message.warning(t('app.data_root.message.select_valid_first'));
          return;
      }
      setDataRootApplying(true);
      try {
          const res = await ApplyDataRootDirectory(nextPath, migrate);
          if (!res?.success) {
              throw new Error(res?.message || t('app.data_root.message.apply_failed'));
          }
          const data = (res?.data || {}) as any;
          setDataRootInfo(data);
          setSelectedDataRootPath(String(data.path || nextPath));
          void message.success(res?.message || t('app.data_root.message.updated'));
      } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error || t('common.unknown'));
          void message.error(t('app.data_root.message.apply_failed_with_error', { error: errMsg }));
      } finally {
          setDataRootApplying(false);
      }
  }, [dataRootInfo?.defaultPath, selectedDataRootPath, t]);

  const handleOpenDataRoot = useCallback(async () => {
      try {
          const res = await OpenDataRootDirectory();
          if (!res?.success) {
              throw new Error(res?.message || t('app.data_root.message.open_failed'));
          }
      } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error || t('common.unknown'));
          void message.error(t('app.data_root.message.open_failed_with_error', { error: errMsg }));
      }
  }, [t]);

  const handleCopyDataRoot = useCallback(() => {
      const text = String(dataRootInfo?.path || '');
      if (!text) {
          return;
      }
      if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(() => {
              void message.success(t('app.data_root.message.copied'));
          }, () => {
              void message.error(t('common.unknown'));
          });
      }
  }, [dataRootInfo?.path, t]);

  const loadServyEngineConfig = useCallback(async () => {
      try {
          const res = await GetServyEngineConfig();
          if (!res?.success) {
              throw new Error(res?.message || t('common.unknown'));
          }
          const data = (res?.data || {}) as any;
          setServyEngineConfig(data);
          setServyEnginePathDraft(String(data.configuredPath || ''));
      } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error || t('common.unknown'));
          void message.error(errMsg);
      }
  }, [t]);

  useEffect(() => {
      if (!isDataRootModalOpen && !activeSettingsCenterPane?.key.startsWith('data-root')) {
          return;
      }
      void loadServyEngineConfig();
  }, [activeSettingsCenterPane?.key, isDataRootModalOpen, loadServyEngineConfig]);

  const handleBrowseServyEngineFile = useCallback(async () => {
      try {
          const res = await SelectServyEngineFile();
          if (!res?.success) {
              return;
          }
          const data = (res?.data || {}) as { path?: string };
          const picked = String(data.path || '').trim();
          if (picked) {
              setServyEnginePathDraft(picked);
          }
      } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error || t('common.unknown'));
          void message.error(t('app.data_root.message.select_failed_with_error', { error: errMsg }));
      }
  }, [t]);

  const handleApplyServyEnginePath = useCallback(async (useDefault = false) => {
      const nextPath = useDefault ? '' : String(servyEnginePathDraft || '').trim();
      setServyEngineApplying(true);
      try {
          const res = await ApplyServyEnginePath(nextPath);
          if (!res?.success) {
              throw new Error(res?.message || t('common.unknown'));
          }
          const data = (res?.data || {}) as any;
          setServyEngineConfig(data);
          setServyEnginePathDraft(String(data.configuredPath || ''));
          // 侧栏底部引擎状态栏据此刻刷新
          window.dispatchEvent(new Event('gonavi:servy-engine-updated'));
          void message.success(res?.message || t('app.engine.backend.message.applied'));
      } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error || t('common.unknown'));
          void message.error(errMsg);
      } finally {
          setServyEngineApplying(false);
      }
  }, [servyEnginePathDraft, t]);

  const renderDataDirectorySettings = (
      section: 'all' | 'application' | 'agent' = 'all',
      readOnly = false,
  ) => {
      if (dataRootLoading) {
          return (
              <div style={{ padding: '28px 0', textAlign: 'center' }}>
                  <Spin />
              </div>
          );
      }
      return (
          <div
              style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0' }}
              data-data-directory-layout="true"
          >
              {(section === 'all' || section === 'application') && (
              <DataDirectoryPage testId="application">
                  <section
                      className="gn-storage-panel gn-storage-panel--current"
                      data-data-directory-section="application"
                  >
                      <div className="gn-storage-panel__body">
                          <div className="gn-storage-panel__header">
                              <DirectorySectionHeading
                                  title={t('app.data_root.current_location')}
                                  description={t('app.data_root.application.current_description')}
                              />
                              {!readOnly && (
                                  <div style={{ display: 'flex', gap: 8 }}>
                                      <Button icon={<FolderOpenOutlined />} onClick={() => void handleOpenDataRoot()}>
                                          {t('app.data_root.action.open_current')}
                                      </Button>
                                      <Button icon={<CopyOutlined />} onClick={handleCopyDataRoot}>
                                          {t('app.data_root.action.copy_path')}
                                      </Button>
                                  </div>
                              )}
                          </div>
                          <DirectoryPathDisplay
                              label={t('app.data_root.current_directory')}
                              path={dataRootInfo?.path || ''}
                          />
                          <div>
                              <div className="gn-storage-field-label">{t('app.data_root.application.stores')}</div>
                              <div className="gn-storage-tags">
                                  <span className="gn-storage-tag">{t('app.data_root.application.content.service_registry')}</span>
                                  <span className="gn-storage-tag">{t('app.data_root.application.content.managed_config')}</span>
                                  <span className="gn-storage-tag">{t('app.data_root.application.content.managed_logs')}</span>
                              </div>
                          </div>
                          <DirectoryMetaGrid items={[
                              {
                                  label: t('app.data_root.service_log_root'),
                                  value: dataRootInfo?.path ? `${dataRootInfo.path}\\services` : '-',
                                  hint: t('app.data_root.service_log_root_hint'),
                              },
                              {
                                  label: t('app.data_root.engine_default_dir'),
                                  value: servyEngineConfig?.appDir || '-',
                                  hint: t('app.data_root.engine_default_dir_hint'),
                              },
                          ]} />
                      </div>
                  </section>

                  {!readOnly && (
                      <section className="gn-storage-panel" data-log-retention-settings="true">
                          <div className="gn-storage-panel__body">
                              <div className="gn-storage-panel__header">
                                  <DirectorySectionHeading
                                      title={t('app.data_root.log_retention.title')}
                                      description={t('app.data_root.log_retention.desc')}
                                  />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                  <span className="gn-storage-field-label">{t('app.data_root.log_retention.keep')}</span>
                                  <SegmentedControl
                                      accent
                                      options={LOG_RETENTION_OPTIONS.map((option) => ({
                                          value: String(option.value),
                                          label: option.value === -1
                                              ? t('app.data_root.log_retention.permanent')
                                              : t('app.data_root.log_retention.days', { n: option.value }),
                                      }))}
                                      value={String(logRetentionDays ?? 7)}
                                      onChange={(value) => handleLogRetentionChange(Number(value))}
                                      ariaLabel={t('app.data_root.log_retention.title')}
                                  />
                              </div>
                              <DirectoryNote>
                                  {t('app.data_root.log_retention.note')}
                              </DirectoryNote>
                          </div>
                      </section>
                  )}

                  {!readOnly && (
                      <section className="gn-storage-panel" data-servy-engine-settings="true">
                          <div className="gn-storage-panel__body">
                              <div className="gn-storage-panel__header">
                                  <DirectorySectionHeading
                                      title={t('app.engine.title')}
                                      description={t('app.engine.description')}
                                  />
                                  <span className="gn-storage-tag">
                                      {servyEngineConfig?.available ? t('app.engine.ready') : t('app.engine.missing')}
                                  </span>
                              </div>
                              <DirectoryMetaGrid items={[
                                  {
                                      label: t('app.engine.info.version'),
                                      value: servyEngineConfig?.version ? `v${servyEngineConfig.version}` : '-',
                                  },
                                  {
                                      label: t('app.engine.info.app_dir'),
                                      value: servyEngineConfig?.appDir || '-',
                                  },
                              ]} />
                              <div className="gn-storage-path-editor">
                                  <Input
                                      value={servyEnginePathDraft}
                                      placeholder={servyEngineConfig?.available && servyEngineConfig?.path
                                          ? servyEngineConfig.path
                                          : t('app.engine.path_input_placeholder')}
                                      aria-label={t('app.engine.path_label')}
                                      onChange={(event) => setServyEnginePathDraft(event.target.value)}
                                  />
                                  <div className="gn-storage-path-editor__actions">
                                      <Button
                                          disabled={servyEngineApplying}
                                          onClick={() => void handleBrowseServyEngineFile()}
                                      >
                                          {t('app.engine.action.browse')}
                                      </Button>
                                      <Button
                                          disabled={servyEngineApplying}
                                          onClick={() => void handleApplyServyEnginePath(true)}
                                      >
                                          {t('app.data_root.action.restore_default_directory')}
                                      </Button>
                                      <Button
                                          type="primary"
                                          loading={servyEngineApplying}
                                          onClick={() => void handleApplyServyEnginePath(false)}
                                      >
                                          {t('app.engine.action.apply')}
                                      </Button>
                                  </div>
                              </div>
                              <DirectoryNote>{t('app.engine.hint.default_location')}{t('app.engine.hint.no_re-register')}</DirectoryNote>
                          </div>
                      </section>
              )}

              {!readOnly && (
                      <section className="gn-storage-panel">
                          <div className="gn-storage-panel__body">
                              <DirectorySectionHeading
                                  title={t('app.data_root.change_location')}
                                  description={t('app.data_root.change_location_description')}
                              />
                              <div className="gn-storage-path-editor">
                                  <Input
                                      readOnly
                                      value={selectedDataRootPath}
                                      placeholder={t('app.data_root.placeholder.select_new_directory')}
                                      aria-label={t('app.data_root.switch_target')}
                                  />
                                  <div className="gn-storage-path-editor__actions">
                                      <Button
                                          icon={<FolderOpenOutlined />}
                                          disabled={directorySettingsApplying}
                                          onClick={() => void handleSelectDataRoot()}
                                      >
                                          {t('app.data_root.action.select')}
                                      </Button>
                                      <Button
                                          disabled={directorySettingsApplying}
                                          loading={dataRootApplying}
                                          onClick={() => void handleApplyDataRoot(false, true)}
                                      >
                                          {t('app.data_root.action.restore_default_directory')}
                                      </Button>
                                  </div>
                              </div>
                              <div className="gn-storage-choice-grid">
                                  <DirectoryChoice
                                      title={t('app.data_root.action.switch_now')}
                                      description={t('app.data_root.switch_only_hint')}
                                      action={(
                                          <Button
                                              disabled={directorySettingsApplying}
                                              loading={dataRootApplying}
                                              onClick={() => void handleApplyDataRoot(false)}
                                          >
                                              {t('app.data_root.action.switch_now')}
                                          </Button>
                                      )}
                                  />
                                  <DirectoryChoice
                                      recommended
                                      badge={t('app.data_root.recommended')}
                                      title={t('app.data_root.action.migrate_now')}
                                      description={t('app.data_root.migrate_hint')}
                                      action={(
                                          <Button
                                              type="primary"
                                              disabled={directorySettingsApplying}
                                              loading={dataRootApplying}
                                              onClick={() => void handleApplyDataRoot(true)}
                                          >
                                              {t('app.data_root.action.migrate_now')}
                                          </Button>
                                      )}
                                  />
                              </div>
                              <DirectoryNote>{t('app.data_root.restart_hint')}</DirectoryNote>
                          </div>
                      </section>
                  )}
              </DataDirectoryPage>
              )}


          </div>
      );
  };


  const {
      handleCloseLogPanel: handleCloseAppLogPanel,
      handleLogResizeStart,
      isLogPanelOpen,
      logGhostRef,
      logPanelHeight,
  } = useAppLogPanelResize();
  const handleToggleLogPanel = useCallback(() => {
      window.dispatchEvent(new CustomEvent('gonavi:show-sql-execution-log', { detail: { mode: 'open' } }));
  }, []);
  const handleCloseLogPanel = useCallback(() => {
      handleCloseAppLogPanel();
  }, [handleCloseAppLogPanel]);

  const handleWebLogout = useCallback(async () => {
      try {
          await fetch('/__gonavi/auth/logout', {
              method: 'POST',
              credentials: 'same-origin',
          });
      } catch (_) {
          // ignore
      }
      window.location.assign('/login');
  }, []);

  const handleTitleBarWindowToggle = async (options?: { allowMacNativeFullscreen?: boolean }) => {
      const allowMacNativeFullscreen = options?.allowMacNativeFullscreen === true;
      const syncWindowStateFromRuntime = async () => {
          try {
              const [isFullscreen, isMaximised] = await Promise.all([
                  safeWindowRuntimeCall(() => WindowIsFullscreen(), false),
                  safeWindowRuntimeCall(() => WindowIsMaximised(), false),
              ]);
              useStore.getState().setWindowState(isFullscreen ? 'fullscreen' : (isMaximised ? 'maximized' : 'normal'));
          } catch {
              // ignore
          }
      };

      try {
          void emitWindowDiagnostic('action:titlebar-toggle:before');
          if (await WindowIsFullscreen()) {
              await WindowUnfullscreen();
              await syncWindowStateFromRuntime();
              void emitWindowDiagnostic('action:titlebar-toggle:after-unfullscreen');
              return;
          }
          if (allowMacNativeFullscreen && useNativeMacWindowControls && isMacRuntime) {
              await WindowFullscreen();
              await syncWindowStateFromRuntime();
              void emitWindowDiagnostic('action:titlebar-toggle:after-fullscreen');
              return;
          }
          const isMaximised = await safeWindowRuntimeCall(() => WindowIsMaximised(), false);
          if (isMaximised) {
              WindowUnmaximise();
          } else {
              // Preserve the latest normal bounds before the native maximise transition
              // makes WindowGetSize report the maximised surface.
              await captureMainWindowStateRef.current();
              WindowMaximise();
          }
          await waitForWindowCondition({
              read: async () => (await WindowIsMaximised()) !== isMaximised,
              wait: (delayMs) => new Promise((resolve) => window.setTimeout(resolve, delayMs)),
              maxChecks: 16,
              intervalMs: 40,
          });
          await syncWindowStateFromRuntime();
          void emitWindowDiagnostic('action:titlebar-toggle:after-set-maximise-state');
      } catch (_) {
          // ignore
      }
  };

  const handleTitleBarDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-no-titlebar-toggle="true"]')) {
          return;
      }
      void handleTitleBarWindowToggle({ allowMacNativeFullscreen: false });
  };

  // handleManualResetWindowZoom 由 resetWindowZoom 快捷键（默认 Ctrl+Shift+0）触发，
  // 作为自动路径失败时的兜底入口。
  //
  // 优先调 backend App.ResetWebViewZoom 走 WebView2 zoom reset（零动画零感知）；
  // 失败时回退到 Unmaximise→Maximise toggle —— 用户主动按了快捷键，预期看见动画。
  const handleManualResetWindowZoom = React.useCallback(async () => {
      if (!isWindowsPlatform()) {
          message.info(t('app.window_zoom.message.windows_only'));
          return;
      }
      try {
          const res = await (window as any).go?.app?.App?.ResetWebViewZoom?.();
          if (res?.success) {
              window.dispatchEvent(new Event('resize'));
              message.success(t('app.window_zoom.message.reset_success'));
              return;
          }
          console.warn('ResetWebViewZoom backend reported failure, falling back to maximise toggle:', res?.message);
      } catch (e) {
          console.warn('ResetWebViewZoom backend unavailable, falling back to maximise toggle', e);
      }
      try {
          const isFullscreen = await safeWindowRuntimeCall(() => WindowIsFullscreen(), false);
          if (isFullscreen) {
              message.info(t('app.window_zoom.message.fullscreen_exit_first'));
              return;
          }
          const isMaximised = await safeWindowRuntimeCall(() => WindowIsMaximised(), false);
          if (isMaximised) {
              WindowUnmaximise();
              await new Promise((resolve) => window.setTimeout(resolve, 96));
              WindowMaximise();
              await new Promise((resolve) => window.setTimeout(resolve, 96));
          } else {
              const size = await safeWindowRuntimeCall(() => WindowGetSize(), null);
              const width = Math.trunc(Number(size?.w) || 0);
              const height = Math.trunc(Number(size?.h) || 0);
              if (width > 0 && height > 0) {
                  WindowSetSize(getWindowsScaleFixNudgedWidth(width), height);
                  await new Promise((resolve) => window.setTimeout(resolve, 28));
                  WindowSetSize(width, height);
              }
          }
          window.dispatchEvent(new Event('resize'));
          message.success(t('app.window_zoom.message.reset_success_fallback'));
      } catch (e) {
          console.warn('Failed to reset window zoom', e);
          message.error(t('app.window_zoom.message.reset_failed'));
      }
  }, [t]);

  const {
      handleSidebarMouseDown,
      sidebarResizeHandleWidth,
      siderRef,
  } = useAppSidebarResize({
      effectiveUiScale,
      setSidebarWidth,
      sidebarWidth,
      sidebarCollapsed: isSidebarCollapsed,
  });
  const sidebarResizeHit = resolveSidebarResizeHitGeometry(sidebarResizeHandleWidth);

  // Apply the document theme before the first paint. V2 structural styles are
  // scoped by data-ui-version; a passive effect leaves one unstyled titlebar
  // frame where the centered context and its marker collapse into the legacy
  // flex layout.
  useLayoutEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.body.style.color = darkMode ? '#ffffff' : '#000000';
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    document.body.setAttribute('data-ui-version', 'v2');
    document.body.setAttribute('data-platform', documentPlatform);
    document.body.style.fontSize = `${effectiveFontSize}px`;
    document.body.style.setProperty('--gn-font-sans', resolvedUiFontFamily);
    document.body.style.setProperty('--gn-font-mono', resolvedMonoFontFamily);
    document.documentElement.style.setProperty('--gonavi-font-size', `${effectiveFontSize}px`);
    document.documentElement.style.setProperty('--gn-font-sans', resolvedUiFontFamily);
    document.documentElement.style.setProperty('--gn-font-mono', resolvedMonoFontFamily);
    document.documentElement.style.setProperty('--gn-ui-scale', `${effectiveUiScale}`);
    document.documentElement.style.setProperty('--gn-window-opacity', `${effectiveOpacity}`);
    document.documentElement.style.setProperty('--gn-window-opacity-percent', `${effectiveOpacity * 100}%`);
    document.documentElement.style.setProperty('--gn-font-size', `${effectiveFontSize}px`);
    document.documentElement.style.setProperty('--gn-font-size-sm', `${Math.max(10, Math.round(effectiveFontSize * 0.86))}px`);
    document.documentElement.style.setProperty('--gn-font-size-xs', `${Math.max(9, Math.round(effectiveFontSize * 0.76))}px`);
    document.documentElement.style.setProperty('--gn-font-size-mono', `${Math.max(10, Math.round(effectiveDataTableFontSize * 0.92))}px`);
    document.documentElement.style.setProperty('--gn-data-table-font-size', `${effectiveDataTableFontSize}px`);
    document.documentElement.style.setProperty('--gn-sidebar-tree-font-size', `${effectiveSidebarTreeFontSize}px`);
    document.documentElement.style.setProperty('--gn-sidebar-rail-scale', `${effectiveSidebarRailScale}`);
    document.documentElement.style.setProperty('--gn-control-height', `${tokenControlHeight}px`);
    document.documentElement.style.setProperty('--gn-control-height-sm', `${tokenControlHeightSM}px`);
  }, [
    darkMode,
    effectiveDataTableFontSize,
    effectiveFontSize,
    effectiveOpacity,
    resolvedMonoFontFamily,
    resolvedUiFontFamily,
    documentPlatform,
    effectiveSidebarRailScale,
    effectiveSidebarTreeFontSize,
    effectiveUiScale,
    tokenControlHeight,
    tokenControlHeightSM,
  ]);


  useEffect(() => {
      const handleOpenServyEngineSettingsEvent = () => {
          handleOpenToolCenterPane('config', 'data-root-application');
      };
      window.addEventListener('gonavi:open-servy-engine-settings', handleOpenServyEngineSettingsEvent as EventListener);
      return () => {
          window.removeEventListener('gonavi:open-servy-engine-settings', handleOpenServyEngineSettingsEvent as EventListener);
      };
  }, [handleOpenToolCenterPane]);

  // 服务总览（页签形态）的「注册服务」按钮走事件总线打开注册弹窗
  useEffect(() => {
      const handleOpenAddServiceEvent = () => setIsAddServiceModalOpen(true);
      window.addEventListener('gonavi:open-add-service', handleOpenAddServiceEvent as EventListener);
      return () => {
          window.removeEventListener('gonavi:open-add-service', handleOpenAddServiceEvent as EventListener);
      };
  }, []);

  useEffect(() => {
      if (!isMacRuntime || !useNativeMacWindowControls) {
          return;
      }

      const handleMacNativeEscapeCapture = (event: KeyboardEvent) => {
          if (!shouldSuppressMacNativeEscapeExit(
              isMacRuntime,
              useNativeMacWindowControls,
              useStore.getState().windowState === 'fullscreen',
              event,
              { isEditableTarget: isEditableElement(event.target) },
          )) {
              return;
          }
          event.preventDefault();
          event.stopPropagation();
      };

      window.addEventListener('keydown', handleMacNativeEscapeCapture, true);
      return () => {
          window.removeEventListener('keydown', handleMacNativeEscapeCapture, true);
      };
  }, [isMacRuntime, useNativeMacWindowControls]);

  useEffect(() => {
      const handleExplicitCloseShortcutScope = (event: Event) => {
          const nextScope = resolveCloseShortcutScopeFromTarget(event.target);
          if (nextScope) {
              closeShortcutScopeRef.current = nextScope;
          }
      };

      document.addEventListener('pointerdown', handleExplicitCloseShortcutScope, true);
      document.addEventListener('focusin', handleExplicitCloseShortcutScope, true);
      return () => {
          document.removeEventListener('pointerdown', handleExplicitCloseShortcutScope, true);
          document.removeEventListener('focusin', handleExplicitCloseShortcutScope, true);
      };
  }, []);

  useEffect(() => {
      const handleGlobalShortcut = (event: KeyboardEvent) => {
          const closeDecision = resolveCloseShortcutKeydownDecision({
              event,
              shortcutOptions,
              platform: activeShortcutPlatform,
              capturingShortcut: false,
              imeComposing: isImeComposingKeyEvent(event),
              interactionBlocked: isCloseShortcutInteractionBlocked(event.target, document),
          });
          if (closeDecision.preventDefault) {
              event.preventDefault();
          }
          if (closeDecision.kind === 'consume') {
              event.stopImmediatePropagation();
              return;
          }
          if (closeDecision.kind === 'close') {
              event.stopImmediatePropagation();
              if (closeShortcutScopeRef.current === 'workspace') {
                  dispatchCloseActiveWorkspaceTab();
              } else if (closeShortcutScopeRef.current === 'result') {
                  const currentState = useStore.getState();
                  const targetTabId = resolveDockedActiveTabId(
                      currentState.tabs,
                      currentState.activeTabId,
                      currentState.detachedWorkbenchWindows,
                  );
                  const outcome = dispatchCloseActiveResultTab(targetTabId);
                  if (outcome === 'hidden') {
                      closeShortcutScopeRef.current = 'blocked';
                  }
              }
              return;
          }

          const delegatedAction = closeDecision.kind === 'delegate'
              ? closeDecision.ownerAction
              : null;
          const matchedAction = SHORTCUT_ACTION_ORDER.find((action) => {
              if (action === 'closeActiveTab') {
                  return false;
              }
              if (delegatedAction && action !== delegatedAction) {
                  return false;
              }
              const meta = SHORTCUT_ACTION_META[action];
              if (meta.scope && meta.scope !== 'global') {
                  return false;
              }
              const binding = resolveShortcutBinding(shortcutOptions, action, activeShortcutPlatform);
              if (!binding?.enabled) {
                  return false;
              }
              if (isEditableElement(event.target) && !meta.allowInEditable) {
                  return false;
              }
              return isShortcutMatch(event, binding.combo);
          });

          if (!matchedAction) {
              return;
          }

          event.preventDefault();
          event.stopPropagation();

          switch (matchedAction) {
              case 'runQuery':
                  window.dispatchEvent(new CustomEvent('gonavi:run-active-query'));
                  break;
              case 'focusSidebarSearch':
                  handleFocusSidebarSearch();
                  break;
              case 'switchToNextTab':
                  switchActiveTabByOffset(1);
                  break;
              case 'switchToPreviousTab':
                  switchActiveTabByOffset(-1);
                  break;
              case 'toggleLogPanel':
                  handleToggleLogPanel();
                  break;
              case 'toggleTheme':
                  selectPresetTheme(themeMode === 'dark' ? 'light' : 'dark');
                  break;
              case 'toggleMacFullscreen':
                  if (isMacRuntime && useNativeMacWindowControls) {
                      void handleTitleBarWindowToggle({ allowMacNativeFullscreen: true });
                  }
                  break;
              case 'resetWindowZoom':
                  void handleManualResetWindowZoom();
                  break;
          }
      };

      window.addEventListener('keydown', handleGlobalShortcut, true);
      return () => {
          window.removeEventListener('keydown', handleGlobalShortcut, true);
      };
  }, [activeShortcutPlatform, handleFocusSidebarSearch, handleManualResetWindowZoom, handleTitleBarWindowToggle, handleToggleLogPanel, isMacRuntime, selectPresetTheme, shortcutOptions, switchActiveTabByOffset, themeMode, useNativeMacWindowControls]);

  const linuxResizeHandleStyleBase = {
      position: 'fixed',
      zIndex: 12000,
      background: 'transparent',
      WebkitAppRegion: 'drag',
      '--wails-draggable': 'drag',
      userSelect: 'none'
  } as any;

  const showLinuxResizeHandles = isLinuxRuntime;
  const resizeGuideColor = 'var(--gn-accent, #16a34a)';
  const v2AntPrimaryColor = customThemeAntTokens.primary ?? (darkMode ? '#22c55e' : '#16a34a');
  const v2AntPrimaryContrastColor = customThemeAntTokens.primaryContrast ?? '#ffffff';
  const v2AntPrimaryHoverColor = customThemeAntTokens.primaryHover ?? (darkMode ? '#4ade80' : '#15803d');
  const v2AntPrimaryActiveColor = customThemeAntTokens.primaryActive ?? (darkMode ? '#16a34a' : '#166534');
  const v2AntPrimaryBgColor = customThemeAntTokens.primaryBg ?? (darkMode ? 'rgba(34, 197, 94, 0.20)' : '#dcfce7');
  const v2AntPrimaryBgHoverColor = customThemeAntTokens.primaryBgHover ?? (darkMode ? 'rgba(34, 197, 94, 0.28)' : '#bbf7d0');
  const v2AntPrimaryBorderColor = customThemeAntTokens.primaryBorder ?? (darkMode ? 'rgba(34, 197, 94, 0.42)' : '#86efac');
  const v2AntPrimaryBorderHoverColor = customThemeAntTokens.primaryBorderHover ?? (darkMode ? 'rgba(74, 222, 128, 0.58)' : '#4ade80');
  const v2AntControlActiveBg = customThemeAntTokens.controlActiveBg ?? (darkMode ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.10)');
  const v2AntControlActiveHoverBg = customThemeAntTokens.controlActiveHoverBg ?? (darkMode ? 'rgba(34, 197, 94, 0.24)' : 'rgba(34, 197, 94, 0.16)');
  const v2AntControlOutline = customThemeAntTokens.controlOutline ?? (darkMode ? 'rgba(34, 197, 94, 0.42)' : 'rgba(22, 163, 74, 0.22)');
  const v2AntBgContainer = customThemeAntTokens.bgContainer;
  const v2AntBgElevated = customThemeAntTokens.bgElevated;
  const v2AntFillAlter = customThemeAntTokens.fillAlter;
  const v2AntTextPrimary = customThemeAntTokens.textPrimary;
  const v2AntTextSecondary = customThemeAntTokens.textSecondary;
  const v2AntBorder = customThemeAntTokens.border;
  const v2AntRowHoverBg = customThemeAntTokens.rowHoverBg;
  const v2AntInfoColor = customThemeAntTokens.info ?? v2AntPrimaryColor;
  const antdTheme = useMemo(() => ({
      algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
          fontSize: tokenFontSize,
          fontSizeSM: tokenFontSizeSM,
          fontSizeLG: tokenFontSizeLG,
          fontFamily: resolvedUiFontFamily,
          fontFamilyCode: resolvedMonoFontFamily,
          zIndexPopupBase: APP_OVERLAY_Z_INDEX_BASE,
          controlHeight: tokenControlHeight,
          controlHeightSM: tokenControlHeightSM,
          controlHeightLG: tokenControlHeightLG,
          colorBgLayout: 'transparent',
          colorBgContainer: v2AntBgContainer ?? (darkMode
              ? `rgba(29, 29, 29, ${effectiveOpacity})`
              : `rgba(255, 255, 255, ${effectiveOpacity})`),
          colorBgElevated: v2AntBgElevated ?? (darkMode
              ? '#1f1f1f'
              : '#ffffff'),
          colorFillAlter: v2AntFillAlter ?? (darkMode
              ? `rgba(38, 38, 38, ${effectiveOpacity})`
              : `rgba(250, 250, 250, ${effectiveOpacity})`),
          ...(v2AntTextPrimary ? { colorText: v2AntTextPrimary } : {}),
          ...(v2AntTextSecondary ? { colorTextSecondary: v2AntTextSecondary } : {}),
          ...(v2AntBorder ? {
              colorBorder: v2AntBorder,
              colorBorderSecondary: v2AntBorder,
          } : {}),
          colorPrimary: v2AntPrimaryColor,
          colorTextLightSolid: v2AntPrimaryContrastColor,
          colorPrimaryHover: v2AntPrimaryHoverColor,
          colorPrimaryActive: v2AntPrimaryActiveColor,
          colorInfo: v2AntInfoColor,
          colorLink: v2AntPrimaryColor,
          colorLinkHover: v2AntPrimaryHoverColor,
          colorLinkActive: v2AntPrimaryActiveColor,
          colorPrimaryBg: v2AntPrimaryBgColor,
          colorPrimaryBgHover: v2AntPrimaryBgHoverColor,
          colorPrimaryBorder: v2AntPrimaryBorderColor,
          colorPrimaryBorderHover: v2AntPrimaryBorderHoverColor,
          controlItemBgActive: v2AntControlActiveBg,
          controlItemBgActiveHover: v2AntControlActiveHoverBg,
          controlOutline: v2AntControlOutline,
      },
      components: {
          Layout: {
              bodyBg: 'transparent',
              headerBg: 'transparent',
              siderBg: 'transparent',
              triggerBg: 'transparent'
          },
          Table: {
              headerBg: 'transparent',
              rowHoverBg: v2AntRowHoverBg
                  ?? (darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.02)'),
          },
          Tabs: {
              cardBg: 'transparent',
              itemActiveColor: v2AntPrimaryHoverColor,
              itemHoverColor: v2AntPrimaryHoverColor,
              itemSelectedColor: v2AntPrimaryColor,
              inkBarColor: v2AntPrimaryColor,
          }
      }
  }), [
      darkMode,
      effectiveOpacity,
      v2AntBgContainer,
      v2AntBgElevated,
      v2AntBorder,
      v2AntControlActiveBg,
      v2AntControlActiveHoverBg,
      v2AntControlOutline,
      v2AntFillAlter,
      v2AntInfoColor,
      v2AntPrimaryActiveColor,
      v2AntPrimaryBgColor,
      v2AntPrimaryBgHoverColor,
      v2AntPrimaryBorderColor,
      v2AntPrimaryBorderHoverColor,
      v2AntPrimaryColor,
      v2AntPrimaryContrastColor,
      v2AntPrimaryHoverColor,
      v2AntRowHoverBg,
      v2AntTextPrimary,
      v2AntTextSecondary,
      tokenControlHeight,
      tokenControlHeightLG,
      tokenControlHeightSM,
      tokenFontSize,
      tokenFontSizeLG,
      tokenFontSizeSM,
      resolvedMonoFontFamily,
      resolvedUiFontFamily,
  ]);
  const filterFontOption = useCallback((input: string, option?: { value?: string; label?: React.ReactNode }) => (
      matchFontFamilyOption(input, {
          value: String(option?.value || ''),
          label: String(option?.label || ''),
      })
  ), []);
  const renderFontOptionLabel = useCallback((option: FontFamilyOption) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.35 }}>
          <span>{option.label}</span>
          <span style={{ fontSize: 11, color: darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(16,24,40,0.45)' }}>
              {option.value}
          </span>
      </div>
  ), [darkMode]);
  const showLinuxCJKFontBanner = Boolean(
      linuxCJKFontInstallHint &&
      hasLoadedInstalledFontsRef.current &&
      !isFontFamiliesLoading &&
      !fontFamiliesLoadError &&
      !isLinuxCJKFontBannerDismissed,
  );
  const updateInstallActionLabel = updateInstallAction === 'install-and-restart'
      ? t('app.about.action.install_and_restart')
      : (updateInstallAction === 'launch-installer'
          ? t('app.about.action.launch_installer')
          : t('app.about.action.restart_to_update'));
  const updateDownloadActionLabel = lastUpdateInfo?.packageType === 'msi'
      ? t('app.about.action.download_msi_update')
      : (lastUpdateInfo?.packageType === 'portable'
          ? t('app.about.action.download_portable_update')
          : t('app.about.action.download_update'));
  const renderAboutUpdateActions = () => [
      isBackgroundProgressForLatestUpdate && !isLatestUpdateDownloaded ? (
          <Button key="progress" icon={<DownloadOutlined />} onClick={showUpdateDownloadProgress}>{t('app.about.action.download_progress')}</Button>
      ) : null,
      lastUpdateInfo?.hasUpdate && !isLatestUpdateDownloaded && !isBackgroundProgressForLatestUpdate ? (
          <Button key="mute" onClick={muteLatestUpdate}>{t('app.about.action.mute_this_version')}</Button>
      ) : null,
      <Button
          key="check"
          icon={<CloudDownloadOutlined />}
          loading={isCheckingForUpdates}
          onClick={() => checkForUpdates(false, true)}
      >
          {t('app.about.action.check_updates')}
      </Button>,
      lastUpdateInfo?.hasUpdate && !isLatestUpdateDownloaded && !isBackgroundProgressForLatestUpdate ? (
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadUpdateWithNotes}>{updateDownloadActionLabel}</Button>
      ) : null,
      isLatestUpdateDownloaded ? (
          <Button key="open-install-directory" onClick={openDownloadedUpdateDirectory}>
              {t('app.about.action.open_install_directory')}
          </Button>
      ) : null,
      isLatestUpdateDownloaded ? (
          <Button
              key="restart-to-update"
              type="primary"
              icon={<SyncOutlined />}
              onClick={() => { void handleInstallUpdateRequest(); }}
          >
              {updateInstallActionLabel}
          </Button>
      ) : null,
  ].filter(Boolean);

  const renderAboutSettingsContent = () => (
      aboutLoading ? (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <Spin />
          </div>
      ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={utilityPanelStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      <div>
                          <div style={{ marginBottom: 6, fontWeight: 600 }}>{t('app.about.field.version')}</div>
                          <div style={utilityMutedTextStyle}>{aboutDisplayVersion}</div>
                      </div>
                      <div>
                          <div style={{ marginBottom: 6, fontWeight: 600 }}>{t('app.about.field.author')}</div>
                          <div style={utilityMutedTextStyle}>{aboutInfo?.author || t('common.unknown')}</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ marginBottom: 6, fontWeight: 600 }}>{t('app.about.field.update_status')}</div>
                          <div style={utilityMutedTextStyle}>{aboutUpdateStatus || t('app.about.update_status.not_checked')}</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ marginBottom: 6, fontWeight: 600 }}>{t('app.about.field.update_channel')}</div>
                          <Select
                              value={updateChannel}
                              options={[
                                  { value: 'latest', label: t('app.about.update_channel.latest') },
                                  { value: 'dev', label: t('app.about.update_channel.dev') },
                              ]}
                              onChange={(value) => {
                                  void changeUpdateChannel(String(value));
                              }}
                              loading={isUpdateChannelLoading}
                              disabled={
                                  isUpdateChannelLoading
                                  || isUpdateChannelSaving
                                  || updateDownloadProgress.status === 'start'
                                  || updateDownloadProgress.status === 'downloading'
                              }
                              style={{ width: 220, maxWidth: '100%' }}
                          />
                      </div>
                      {aboutInfo?.communityUrl ? (
                          <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ marginBottom: 6, fontWeight: 600 }}>{t('app.about.field.community')}</div>
                          </div>
                      ) : null}
                  </div>
              </div>
              <div style={utilityPanelStyle}>
                  <div style={{ marginBottom: 10, fontWeight: 600 }}>{t('app.about.project_links')}</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GithubOutlined />
                          {aboutInfo?.repoUrl ? (
                              <a onClick={(e) => { e.preventDefault(); if (aboutInfo?.repoUrl) BrowserOpenURL(aboutInfo.repoUrl); }} href={aboutInfo.repoUrl}>{aboutInfo.repoUrl}</a>
                          ) : t('common.unknown')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <BugOutlined />
                          {aboutInfo?.issueUrl ? (
                              <a onClick={(e) => { e.preventDefault(); if (aboutInfo?.issueUrl) BrowserOpenURL(aboutInfo.issueUrl); }} href={aboutInfo.issueUrl}>{aboutInfo.issueUrl}</a>
                          ) : t('common.unknown')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CloudDownloadOutlined />
                          {aboutInfo?.releaseUrl ? (
                              <a onClick={(e) => { e.preventDefault(); if (aboutInfo?.releaseUrl) BrowserOpenURL(aboutInfo.releaseUrl); }} href={aboutInfo.releaseUrl}>{aboutInfo.releaseUrl}</a>
                          ) : t('common.unknown')}
                      </div>
                  </div>
              </div>
          </div>
      )
  );

  const renderSettingsCenterAboutProjectEntry = ({
      icon,
      title,
      description,
      url,
      copyText,
  }: {
      icon: React.ReactNode;
      title: string;
      description: string;
      url?: string;
      copyText?: string;
  }) => (
      <button
        className="gonavi-about-project-entry"
        type="button"
        onClick={() => {
            if (copyText) {
                void navigator.clipboard.writeText(copyText).then(() => {
                    void message.success(t('app.about.project.wechat.copied'));
                });
                return;
            }
            if (url) {
                BrowserOpenURL(url);
            }
        }}
        disabled={!url && !copyText}
        style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(16,24,40,0.10)'}`,
            borderRadius: 8,
            background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.72)',
            color: darkMode ? 'rgba(255,255,255,0.90)' : '#101828',
            cursor: url || copyText ? 'pointer' : 'not-allowed',
            opacity: url || copyText ? 1 : 0.58,
            textAlign: 'left',
        }}
      >
          <span style={{ fontSize: 18, display: 'grid', placeItems: 'center', marginTop: 1, color: overlayTheme.iconColor }}>
              {icon}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{title}</span>
                  {copyText
                    ? <CopyOutlined style={{ color: overlayTheme.mutedText, fontSize: 12, flexShrink: 0 }} />
                    : <RightOutlined style={{ color: overlayTheme.mutedText, fontSize: 12, flexShrink: 0 }} />}
              </span>
              <span style={{ ...utilityMutedTextStyle, display: 'block', marginTop: 3, lineHeight: 1.4 }}>{description}</span>
          </span>
      </button>
  );

  const renderSettingsCenterAboutPane = () => {
      if (aboutLoading) {
          return (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <Spin />
              </div>
          );
      }

      const hasUpdate = Boolean(lastUpdateInfo?.hasUpdate);
      const latestVersionText = lastUpdateInfo?.latestVersion || t('common.unknown');
      const currentVersionText = lastUpdateInfo?.currentVersion || aboutDisplayVersion;
      const releaseTimeText = formatAboutReleaseTime(lastUpdateInfo?.releasePublishedAt);
      const canOpenReleaseNotes = Boolean(lastUpdateInfo);
      const packageType = ['portable', 'msi', 'dmg', 'archive'].includes(String(lastUpdateInfo?.packageType || ''))
          ? String(lastUpdateInfo?.packageType)
          : 'unknown';
      const mutedText = utilityMutedTextStyle.color;
      const dividerColor = darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(16,24,40,0.09)';
      const versionRows: Array<[string, React.ReactNode]> = [
          [t('app.about.version.current'), currentVersionText],
          [t('app.about.version.latest'), latestVersionText],
          [t('app.about.version.release_time'), releaseTimeText],
          [
              t('app.about.version.release_notes'),
              (
                  <Button
                      type="link"
                      size="small"
                      disabled={!canOpenReleaseNotes}
                      onClick={openReleaseNotesModal}
                      style={{ padding: 0, height: 'auto', fontWeight: 600 }}
                  >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {t('app.about.release_notes.action.view')}
                          {hasUnreadReleaseNotes ? (
                              <span
                                  aria-label={t('app.about.release_notes.unread_badge')}
                                  style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: 999,
                                      background: darkMode ? '#4ade80' : '#16a34a',
                                  }}
                              />
                          ) : null}
                      </span>
                  </Button>
              ),
          ],
          ...(installMode === 'msi' || installMode === 'portable'
              ? [[t('app.about.version.install_mode'), t(`app.about.install_mode.${installMode}`)] as [string, React.ReactNode]]
              : []),
          ...(hasUpdate && packageType !== 'unknown'
              ? [[t('app.about.version.package_type'), t(`app.about.package_type.${packageType}`)] as [string, React.ReactNode]]
              : []),
      ];

      return (
          <div className="gonavi-about-pane">
              <section className="gonavi-about-identity" aria-label="ServDeck">
                  <img
                      src="brand/servdeck-icon.svg"
                      alt="ServDeck"
                      style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 18, lineHeight: 1.15, fontWeight: 800, color: overlayTheme.titleText }}>ServDeck</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap', color: mutedText, fontWeight: 600, fontSize: 12 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <UserOutlined />
                              WEC
                          </span>
                      </div>
                      <div style={{ ...utilityMutedTextStyle, marginTop: 8, lineHeight: 1.6 }}>
                          {t('app.about.intro')}
                      </div>
                  </div>
              </section>
              <section className="gonavi-about-section" aria-label={t('app.about.version.current')}>
                  <div className="gonavi-about-facts">
                      <div className="gonavi-about-fact">
                          <div className="gonavi-about-field-label" style={{ color: overlayTheme.titleText }}>{t('app.about.version.current')}</div>
                          <div style={{ color: mutedText, fontWeight: 500, lineHeight: 1.45 }}>{aboutDisplayVersion}</div>
                      </div>
                  </div>
              </section>
          </div>
      );
  };

  const renderSettingsCenterAboutFooter = () => (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {renderAboutUpdateActions()}
      </div>
  );

  const renderThemeSettingsSection = (title: React.ReactNode, children: React.ReactNode, hint?: React.ReactNode) => (
      <section className="gonavi-settings-section">
          {title ? <div className="gonavi-settings-section-title">{title}</div> : null}
          {hint ? <div className="gonavi-settings-section-hint">{hint}</div> : null}
          <div>{children}</div>
      </section>
  );

  const renderThemeSettingsRow = ({
      label,
      hint,
      control,
      stacked = false,
      controlOnly = false,
  }: {
      label?: React.ReactNode;
      hint?: React.ReactNode;
      control: React.ReactNode;
      stacked?: boolean;
      /** 分区标题已说明用途时，只渲染控件，避免标题重复 */
      controlOnly?: boolean;
  }) => (
      <div className={`gonavi-settings-row${stacked || controlOnly ? ' is-stacked' : ''}${controlOnly ? ' is-control-only' : ''}`}>
          {!controlOnly ? (
              <div>
                  <div className="gonavi-settings-label">{label}</div>
                  {hint ? <div className="gonavi-settings-label-hint">{hint}</div> : null}
              </div>
          ) : null}
          <div className="gonavi-settings-control">{control}</div>
      </div>
  );

  const renderThemeModePreview = (preview: 'light' | 'dark' | 'system') => (
      <div
        aria-hidden
        className={`gonavi-settings-mode-preview${preview === 'system' ? ' is-system' : ''}`}
      >
          {(preview === 'light' || preview === 'system') ? (
              <div className="gonavi-settings-mode-preview-pane is-light">
                  <span className="gonavi-settings-mode-preview-line" />
                  <span className="gonavi-settings-mode-preview-line" />
                  <span className="gonavi-settings-mode-preview-line" />
              </div>
          ) : null}
          {(preview === 'dark' || preview === 'system') ? (
              <div className="gonavi-settings-mode-preview-pane is-dark">
                  <span className="gonavi-settings-mode-preview-line" />
                  <span className="gonavi-settings-mode-preview-line" />
                  <span className="gonavi-settings-mode-preview-line" />
              </div>
          ) : null}
      </div>
  );

  const themeSettingsSections = [
      { value: 'theme' as const, label: t('app.theme.nav.theme.title'), icon: <SkinOutlined /> },
      { value: 'appearance' as const, label: t('app.theme.nav.appearance.title'), icon: <BgColorsOutlined /> },
  ];

  const renderThemeSettingsContentV2 = (options?: { hideSectionTabs?: boolean }) => (
              <div className="gonavi-theme-settings" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '4px 4px 0',
                  height: '100%',
                  minHeight: 0,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
              }}>
                  {options?.hideSectionTabs ? null : (
                  <div style={{ flexShrink: 0, display: 'grid', gap: 4 }}>
                      <div className="gonavi-settings-tabs" role="tablist" aria-label={t('app.settings.entry.theme.title')}>
                          {themeSettingsSections.map((item, itemIndex) => {
                              const active = themeModalSection === item.value;
                              return (
                                  <button
                                      key={item.value}
                                      id={`gonavi-theme-settings-tab-${item.value}`}
                                      type="button"
                                      role="tab"
                                      aria-selected={active}
                                      aria-controls={`gonavi-theme-settings-panel-${item.value}`}
                                      tabIndex={active ? 0 : -1}
                                      className={`gonavi-settings-tab${active ? ' is-active' : ''}`}
                                      onClick={() => setThemeModalSection(item.value)}
                                      onKeyDown={(event) => {
                                          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                                              return;
                                          }
                                          event.preventDefault();
                                          const nextIndex = event.key === 'Home'
                                              ? 0
                                              : event.key === 'End'
                                                  ? themeSettingsSections.length - 1
                                                  : event.key === 'ArrowRight'
                                                      ? (itemIndex + 1) % themeSettingsSections.length
                                                      : (itemIndex - 1 + themeSettingsSections.length) % themeSettingsSections.length;
                                          setThemeModalSection(themeSettingsSections[nextIndex].value);
                                          const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
                                          tabs?.[nextIndex]?.focus();
                                      }}
                                  >
                                      <span className="gonavi-settings-tab-icon">{item.icon}</span>
                                      <span>{item.label}</span>
                                  </button>
                              );
                          })}
                      </div>
                  </div>
                  )}
                  <div
                    key={themeModalSection}
                    id={`gonavi-theme-settings-panel-${themeModalSection}`}
                    role={options?.hideSectionTabs ? undefined : 'tabpanel'}
                    aria-labelledby={options?.hideSectionTabs ? undefined : `gonavi-theme-settings-tab-${themeModalSection}`}
                    className="gonavi-settings-center-pane-scroll"
                    style={{
                        minWidth: 0,
                        minHeight: 0,
                        flex: 1,
                        overflowY: 'auto',
                        /* visible：避免 Slider 两端手柄被横向裁切 */
                        overflowX: 'visible',
                        overscrollBehavior: 'contain',
                        paddingRight: 4,
                        paddingLeft: 2,
                        paddingBottom: 20,
                        scrollbarGutter: 'auto',
                    }}
                  >
                      {themeModalSection === 'theme' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {renderThemeSettingsSection(
                                  t('app.theme.mode_title'),
                                  <div className="gonavi-settings-mode-grid" role="radiogroup" aria-label={t('app.theme.mode_title')}>
                                      {([
                                          { key: 'light' as const, label: t('app.theme.mode.light.label'), preview: 'light' as const },
                                          { key: 'dark' as const, label: t('app.theme.mode.dark.label'), preview: 'dark' as const },
                                          { key: 'system' as const, label: t('app.theme.mode.system.label'), preview: 'system' as const },
                                      ]).map((item, itemIndex, themeItems) => {
                                          const active = effectiveThemePreference === item.key;
                                          return (
                                              <button
                                                  key={item.key}
                                                  type="button"
                                                  role="radio"
                                                  aria-checked={active}
                                                  tabIndex={effectiveThemePreference === item.key ? 0 : -1}
                                                  className={`gonavi-settings-mode-tile${active ? ' is-active' : ''}`}
                                                  onClick={() => selectPresetTheme(item.key)}
                                                  onKeyDown={(event) => {
                                                      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                                                          return;
                                                      }
                                                      event.preventDefault();
                                                      const nextIndex = event.key === 'Home'
                                                          ? 0
                                                          : event.key === 'End'
                                                              ? themeItems.length - 1
                                                              : event.key === 'ArrowRight' || event.key === 'ArrowDown'
                                                                  ? (itemIndex + 1) % themeItems.length
                                                                  : (itemIndex - 1 + themeItems.length) % themeItems.length;
                                                      selectPresetTheme(themeItems[nextIndex].key);
                                                      const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
                                                      radios?.[nextIndex]?.focus();
                                                  }}
                                              >
                                                  {renderThemeModePreview(item.preview)}
                                                  <div className="gonavi-settings-mode-meta">
                                                      <span className="gonavi-settings-mode-label">{item.label}</span>
                                                      {active ? <CheckOutlined className="gonavi-settings-mode-check" /> : null}
                                                  </div>
                                              </button>
                                          );
                                      })}
                                  </div>,
                              )}
                              {renderThemeSettingsSection(
                                  t('app.theme.custom.title'),
                                  <CustomThemeManager />,
                              )}
                              {renderThemeSettingsSection(
                                  t('app.theme.toolbar_buttons.title'),
                                  <ToolbarButtonAppearanceSettings />,
                                  t('app.theme.toolbar_buttons.description'),
                              )}
                          </div>
                      ) : themeModalSection === 'appearance' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {renderThemeSettingsSection(
                                  // 设置中心侧栏已显示「显示与字体」，内容区不再重复分区标题
                                  options?.hideSectionTabs ? null : t('app.theme.nav.appearance.title'),
                                  <>
                                      {renderThemeSettingsRow({
                                          label: t('app.theme.appearance.ui_scale_title'),
                                          hint: t('app.theme.appearance.ui_scale_hint'),
                                          stacked: true,
                                          control: (
                                              <ThemeSettingsSlider
                                                  min={MIN_UI_SCALE}
                                                  max={MAX_UI_SCALE}
                                                  step={0.05}
                                                  marks={UI_SCALE_SLIDER_MARKS}
                                                  value={effectiveUiScale}
                                                  unit="percent"
                                                  onChange={(v) => setUiScale(v)}
                                              />
                                          ),
                                      })}
                                      {renderThemeSettingsRow({
                                          label: t('app.theme.appearance.font_size_title'),
                                          stacked: true,
                                          control: (
                                              <ThemeSettingsSlider
                                                  min={MIN_FONT_SIZE}
                                                  max={MAX_FONT_SIZE}
                                                  step={1}
                                                  marks={FONT_SIZE_SLIDER_MARKS}
                                                  value={effectiveFontSize}
                                                  unit="px"
                                                  onChange={(v) => setFontSize(v)}
                                              />
                                          ),
                                      })}
                                      {renderThemeSettingsRow({
                                          label: t('app.theme.appearance.sidebar_rail_scale_title'),
                                          hint: t('app.theme.appearance.sidebar_rail_scale_hint'),
                                          stacked: true,
                                          control: (
                                              <ThemeSettingsSlider
                                                  min={MIN_V2_SIDEBAR_RAIL_SCALE}
                                                  max={MAX_V2_SIDEBAR_RAIL_SCALE}
                                                  step={0.05}
                                                  marks={SIDEBAR_RAIL_SCALE_SLIDER_MARKS}
                                                  value={effectiveSidebarRailScale}
                                                  unit="percent"
                                                  onChange={(value) => setAppearance({
                                                      v2SidebarRailScale: sanitizeV2SidebarRailScaleLocal(value),
                                                  })}
                                              />
                                          ),
                                      })}
                                  </>,
                              )}
                              {renderThemeSettingsSection(
                                  t('app.theme.font_family.title'),
                                  <>
                                      <div style={{ padding: '8px 0' }}>
                                          <div className="gonavi-settings-label" style={{ marginBottom: 8 }}>{t('app.theme.font_family.ui_title')}</div>
                                          <Select
                                              allowClear
                                              showSearch
                                              optionFilterProp="label"
                                              loading={isFontFamiliesLoading}
                                              placeholder={DEFAULT_UI_FONT_FAMILY}
                                              value={appearance.customUIFontFamily ?? undefined}
                                              onChange={(value) => setAppearance({
                                                  customUIFontFamily: sanitizeFontFamilyInput(value),
                                              })}
                                              onClear={() => setAppearance({ customUIFontFamily: null })}
                                              options={uiFontOptions.map((option) => ({
                                                  value: option.value,
                                                  label: option.label,
                                              }))}
                                              filterOption={filterFontOption}
                                              popupMatchSelectWidth
                                              style={{ width: '100%' }}
                                              optionRender={(option) => renderFontOptionLabel({
                                                  value: String(option.data.value),
                                                  label: String(option.data.label),
                                              })}
                                          />
                                          <div className="gonavi-settings-inline-meta">
                                              {fontFamiliesLoadError
                                                  ? t('app.theme.font_family.load_failed_fallback', { error: fontFamiliesLoadError })
                                                  : (installedFontFamilies.length > 0
                                                      ? t('app.theme.font_family.loaded_ui_hint', { count: installedFontFamilies.length })
                                                      : t('app.theme.font_family.loading_ui_hint'))}
                                          </div>
                                          {linuxCJKFontInstallHint && hasLoadedInstalledFontsRef.current && !isFontFamiliesLoading && !fontFamiliesLoadError ? (
                                              <div className="gonavi-settings-alert" style={{ borderColor: darkMode ? 'rgba(250,204,21,0.28)' : 'rgba(217,119,6,0.22)', background: darkMode ? 'rgba(250,204,21,0.08)' : 'rgba(251,191,36,0.12)', color: darkMode ? 'rgba(254,249,195,0.92)' : '#92400e' }}>
                                                  {t('app.theme.font_family.linux_cjk_install_prefix')}
                                                  <span style={{ fontFamily: 'var(--gn-font-mono)', marginLeft: 6 }}>{linuxCJKFontInstallHint}</span>
                                                  {t('app.theme.font_family.linux_cjk_install_suffix')}
                                              </div>
                                          ) : null}
                                      </div>
                                      <div style={{ padding: '8px 0', borderTop: '1px solid var(--gn-settings-line)' }}>
                                          <div className="gonavi-settings-label" style={{ marginBottom: 8 }}>{t('app.theme.font_family.mono_title')}</div>
                                          <Select
                                              allowClear
                                              showSearch
                                              optionFilterProp="label"
                                              loading={isFontFamiliesLoading}
                                              placeholder={DEFAULT_MONO_FONT_FAMILY}
                                              value={appearance.customMonoFontFamily ?? undefined}
                                              onChange={(value) => setAppearance({
                                                  customMonoFontFamily: sanitizeFontFamilyInput(value),
                                              })}
                                              onClear={() => setAppearance({ customMonoFontFamily: null })}
                                              options={monoFontOptions.map((option) => ({
                                                  value: option.value,
                                                  label: option.label,
                                              }))}
                                              filterOption={filterFontOption}
                                              popupMatchSelectWidth
                                              style={{ width: '100%' }}
                                              optionRender={(option) => renderFontOptionLabel({
                                                  value: String(option.data.value),
                                                  label: String(option.data.label),
                                              })}
                                          />
                                          <div className="gonavi-settings-inline-meta">
                                              {fontFamiliesLoadError
                                                  ? t('app.theme.font_family.mono_fallback_hint')
                                                  : t('app.theme.font_family.mono_hint')}
                                          </div>
                                      </div>
                                  </>,
                              )}
                              {renderThemeSettingsSection(
                                  t('app.theme.appearance.transparency_blur_title'),
                                  <>
                                      {renderThemeSettingsRow({
                                          label: t('app.theme.appearance.enable_transparency_blur'),
                                          hint: t('app.theme.appearance.enable_transparency_blur_hint'),
                                          control: (
                                              <Switch
                                                  checked={appearance.enabled !== false}
                                                  onChange={(checked) => setAppearance({ enabled: checked })}
                                              />
                                          ),
                                      })}
                                      <div style={{ opacity: appearance.enabled !== false ? 1 : 0.55 }}>
                                          {renderThemeSettingsRow({
                                              label: t('app.theme.appearance.opacity_title'),
                                              stacked: true,
                                              control: (
                                                  <ThemeSettingsSlider
                                                      min={0.1}
                                                      max={1.0}
                                                      step={0.05}
                                                      marks={OPACITY_SLIDER_MARKS}
                                                      disabled={appearance.enabled === false}
                                                      value={appearance.opacity ?? 1.0}
                                                      unit="percent"
                                                      onChange={(v) => setAppearance({ opacity: v })}
                                                  />
                                              ),
                                          })}
                                          {isWindowsPlatform() ? (
                                              <div className="gonavi-settings-inline-meta">{t('app.theme.appearance.windows_acrylic_hint')}</div>
                                          ) : (
                                              renderThemeSettingsRow({
                                                  label: t('app.theme.appearance.blur_title'),
                                                  hint: t('app.theme.appearance.blur_hint'),
                                                  stacked: true,
                                                  control: (
                                                      <ThemeSettingsSlider
                                                          min={0}
                                                          max={20}
                                                          step={1}
                                                          marks={BLUR_SLIDER_MARKS}
                                                          disabled={appearance.enabled === false}
                                                          value={appearance.blur ?? 0}
                                                          unit="px"
                                                          onChange={(v) => setAppearance({ blur: v })}
                                                      />
                                                  ),
                                              })
                                          )}
                                      </div>
                                  </>,
                              )}
                          </div>
                      ) : null}
                  </div>
              </div>
  );


  const renderThemeSettingsContent = (options?: { hideSectionTabs?: boolean }) => (
    renderThemeSettingsContentV2(options)
  );

  type SettingsCenterNavigationItem = {
      key: string;
      icon: React.ReactNode;
      title: string;
      description: string;
      onClick: () => void;
      children?: ReadonlyArray<SettingsCenterNavigationItem>;
  };

  type SettingsCenterNavigationGroup = {
      key: SettingsCenterGroupKey;
      icon: React.ReactNode;
      title: string;
      description: string;
      items: ReadonlyArray<SettingsCenterNavigationItem>;
  };

  const settingsCenterGroups: SettingsCenterNavigationGroup[] = [
      {
          key: 'preferences' as const,
          icon: <SettingOutlined />,
          title: t('app.settings.group.preferences.title'),
          description: t('app.settings.group.preferences.description'),
          items: [
              {
                  key: 'language',
                  icon: <GlobalOutlined />,
                  title: t('settings.language.title'),
                  description: t('settings.language.description'),
                  onClick: () => handleOpenSettingsCenterPane('preferences', 'language'),
              },
              {
                  key: 'theme',
                  icon: <SkinOutlined />,
                  title: t('app.settings.entry.theme.title'),
                  description: t('app.settings.entry.theme.description'),
                  onClick: () => {
                      setThemeModalSection('theme');
                      handleOpenSettingsCenterPane('preferences', 'theme');
                  },
                  children: themeSettingsSections.map((section) => ({
                      key: `theme-${section.value}`,
                      icon: section.icon,
                      title: section.label,
                      description: section.value === 'appearance'
                          ? t('app.theme.nav.appearance.description')
                          : t('app.theme.nav.theme.description'),
                      onClick: () => {
                          setThemeModalSection(section.value);
                          handleOpenSettingsCenterPane('preferences', 'theme');
                      },
                  })),
              },
          ],
      },
      {
          key: 'about' as const,
          icon: <InfoCircleOutlined />,
          title: t('app.settings.entry.about.title'),
          description: t('app.settings.entry.about.description'),
          items: [],
      },
  ];
  const isSettingsCenterContainedScrollPane =
      activeSettingsCenterPane?.key === 'theme';
  const isV2ThemeSettingsPane = activeSettingsCenterPane?.key === 'theme';
  const activeSettingsCenterDetailPanelStyle: React.CSSProperties = {
      ...toolCenterDetailPanelStyle,
      padding: '0 4px 0 0',
      border: 'none',
      borderBottom: 'none',
      borderRadius: 0,
      background: 'transparent',
  };
  const settingsCenterDetailBodyStyle: React.CSSProperties = isSettingsCenterContainedScrollPane
      ? {
          ...toolCenterDetailBodyStyle,
          overflowY: 'hidden',
          // v2 主题设置页含 Slider 手柄横向伸出，hidden 会裁切贴边圆点
          overflowX: isV2ThemeSettingsPane ? 'visible' : 'hidden',
          // 右侧只留给内层滚动容器，避免 padding + 滚动条叠出大块空白
          paddingRight: 0,
          paddingLeft: isV2ThemeSettingsPane ? 4 : undefined,
      }
      : {
          ...toolCenterDetailBodyStyle,
          paddingRight: 0,
      };
  const renderSettingsCenterPane = () => {
      if (!activeSettingsCenterPane) {
          return null;
      }
      if (activeSettingsCenterPane.key === 'language') {
          return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 0' }}>
                  <div style={utilityPanelStyle}>
                      <LanguageSettingsPanel />
                  </div>
              </div>
          );
      }
      if (activeSettingsCenterPane.key === 'theme') {
          return (
              <div style={{ height: '100%', minHeight: 0 }}>
                  {renderThemeSettingsContent({ hideSectionTabs: true })}
              </div>
          );
      }
      if (activeSettingsCenterPane.key === 'about-go-navi') {
          return renderSettingsCenterAboutPane();
      }
      return null;
  };

  const sidebarPanelCollapseLabel = t('app.sidebar.collapse');
  const sidebarPanelExpandLabel = t('app.sidebar.expand');
  const sidebarPanelToggleLabel = isSidebarCollapsed ? sidebarPanelExpandLabel : sidebarPanelCollapseLabel;
  // 折叠按钮的提示受控：点击后立即收起（hover 链因侧栏收起的布局位移可能悬挂不消失），
  // 移开再移入时经 onOpenChange 重新按 0.3s 延迟显示。
  const [sidebarToggleTipOpen, setSidebarToggleTipOpen] = useState(false);
  const handleTitlebarSidebarToggle = useCallback(() => {
      setSidebarToggleTipOpen(false);
      setIsSidebarCollapsed((collapsed) => !collapsed);
  }, [setIsSidebarCollapsed]);
  const allowDebugNativeContextMenu = isWailsDevNativeContextMenu(import.meta.env.DEV);
  const handleAppContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || shouldAllowNativeContextMenu(event.target, { allowDebugMenu: allowDebugNativeContextMenu })) return;
    event.preventDefault();
  }, [allowDebugNativeContextMenu]);

  return (
    <ConfigProvider
        locale={getAntdLocale(language)}
        componentSize={appComponentSize}
        theme={antdTheme}
    >
        {notificationContextHolder}
        <CustomThemeStyleHost
            contextKey={customThemeStyleContextKey}
            onAntTokensChange={setComputedCustomThemeAntTokens}
        />
        <ToolbarAppearanceStyleHost />
        <Layout
          className="gn-v2-app-root"
          onContextMenu={handleAppContextMenu}
          data-gonavi-close-shortcut-scope="workspace"
          data-empty-workbench={tabs.length === 0 ? 'true' : 'false'}
          data-collapsed-sidebar-actions-docked={
              isCollapsedSidebarActionsDocked ? 'true' : 'false'
          }
          style={{
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
            borderRadius: showLinuxResizeHandles ? 0 : 'var(--gonavi-border-radius)',
            clipPath: showLinuxResizeHandles ? 'none' : 'inset(0 round var(--gonavi-border-radius))',
            backdropFilter: blurFilter,
            WebkitBackdropFilter: blurFilter,
            ['--gn-v2-empty-workbench-titlebar-overlap' as any]: `${resolveDockedTitleBarBandOffset(effectiveUiScale, effectiveSidebarRailScale)}px`,
          }}
        >
          {/* Custom Title Bar */}
          <div
            className={[
              'gn-v2-titlebar',
              useNativeMacWindowControls ? 'gn-v2-titlebar-native-mac' : '',
              isCollapsedSidebarActionsDocked ? 'gn-v2-titlebar-collapsed-docked' : '',
            ].filter(Boolean).join(' ')}
            onDoubleClick={handleTitleBarDoubleClick}
            style={{
                height: titleBarHeight,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                // Match the titlebar to the adjacent theme surface with its compensated opacity.
                background: 'var(--gn-bg-titlebar)',
                userSelect: 'none',
                WebkitAppRegion: isWebRuntime ? 'no-drag' : 'drag',
                '--wails-draggable': isWebRuntime ? 'no-drag' : 'drag',
                '--gn-titlebar-action-height': `${titleBarLayout.actionHeight}px`,
                '--gn-titlebar-button-size': `${titleBarButtonWidth}px`,
                '--gn-titlebar-divider-height': `${titleBarLayout.dividerHeight}px`,
                '--gn-titlebar-collapsed-upper-height': `${titleBarLayout.upperBandHeight}px`,
                '--gn-titlebar-window-controls-width': `${isWebRuntime ? titleBarButtonWidth : (useNativeMacWindowControls ? 0 : titleBarButtonWidth * 3)}px`,
                '--gn-titlebar-native-content-offset': `${getMacNativeTitlebarContentOffset(titleBarHeight, useNativeMacWindowControls)}px`,
                paddingLeft: getMacNativeTitlebarPaddingLeft(effectiveUiScale, useNativeMacWindowControls),
                paddingRight: getMacNativeTitlebarPaddingRight(effectiveUiScale, useNativeMacWindowControls),
                fontSize: tokenFontSize
            } as any}
          >
              <div className="gonavi-titlebar-leading">
                  <Tooltip
                    title={sidebarPanelToggleLabel}
                    placement="bottomRight"
                    mouseEnterDelay={0.3}
                    open={sidebarToggleTipOpen}
                    onOpenChange={setSidebarToggleTipOpen}
                  >
                      <button
                        type="button"
                        data-titlebar-brand-toggle="true"
                        aria-label={sidebarPanelToggleLabel}
                        aria-expanded={!isSidebarCollapsed}
                        onClick={handleTitlebarSidebarToggle}
                        onMouseEnter={() => setBrandLogoHovered(true)}
                        onMouseLeave={() => { setBrandLogoHovered(false); setSidebarToggleTipOpen(false); }}
                        onFocus={() => setBrandLogoHovered(true)}
                        onBlur={() => setBrandLogoHovered(false)}
                        className={brandLogoHovered ? 'is-hovered' : undefined}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 34,
                            height: 34,
                            padding: 0,
                            border: 'none',
                            borderRadius: 7,
                            background: 'transparent',
                            color: brandLogoHovered ? 'var(--gn-fg-1)' : 'var(--gn-fg-3)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            WebkitAppRegion: 'no-drag',
                            '--wails-draggable': 'no-drag',
                        } as any}
                      >
                          {brandLogoHovered
                            ? (isSidebarCollapsed ? <TitleBarPanelUnfoldIcon style={{ width: Math.round(20 * effectiveUiScale), height: Math.round(20 * effectiveUiScale) }} /> : <TitleBarPanelFoldIcon style={{ width: Math.round(20 * effectiveUiScale), height: Math.round(20 * effectiveUiScale) }} />)
                            : <img src="brand/servdeck-icon.svg" alt="ServDeck" style={{ width: 20, height: 20, borderRadius: 5, display: 'block' }} />}
                      </button>
                  </Tooltip>
                  <TitleBarPrimaryActions
                    addServiceLabel={t('service.modal.entry')}
                    onAddService={() => setIsAddServiceModalOpen(true)}
                    connectionGroupLabel={t('service.tree.groups.manage_title')}
                    onConnectionGroupManagement={() => setIsManageServiceGroupsOpen(true)}
                    dataRootLabel={t('app.tools.entry.data_root.title')}
                    onDataRoot={handleOpenDataRootPane}
                  />
                  <div id="gonavi-titlebar-quick-actions" className="gonavi-titlebar-quick-actions-slot" />
              </div>
              {shouldDockCollapsedSidebarActionsInTitlebar && (
                  <div
                    ref={setCollapsedSidebarActionsTarget}
                    hidden={!isCollapsedSidebarActionsDocked}
                    className="gn-v2-collapsed-sidebar-actions"
                    data-collapsed-sidebar-actions="true"
                    data-no-titlebar-toggle="true"
                    role="toolbar"
                    aria-label={t('sidebar.rail.system_actions')}
                    onDoubleClick={(event) => event.stopPropagation()}
                  />
              )}
              {/* Collapsed sidebar titlebar actions end */}
              <div className="gn-v2-titlebar-right">

                  <TitleBarSystemActions
                    settingsLabel={t('app.sidebar.settings')}
                    onOpenSettings={handleOpenSettingsModal}
                  />
                  {isWebRuntime ? (
                      <div
                        onDoubleClick={(e) => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag', '--wails-draggable': 'no-drag' } as any}
                      >
                          <Tooltip title="退出当前 Web 会话">
                              <Button
                                type="text"
                                icon={<PoweroffOutlined />}
                                className="titlebar-web-logout-btn"
                                style={{ height: '100%', borderRadius: 8, width: titleBarButtonWidth }}
                                onClick={() => { void handleWebLogout(); }}
                              />
                          </Tooltip>
                      </div>
                  ) : useNativeMacWindowControls ? null : (
                      <div
                        className="titlebar-window-controls"
                        data-no-titlebar-toggle="true"
                        onDoubleClick={(e) => e.stopPropagation()}
                        style={{ display: 'flex', height: '100%', alignItems: 'center', WebkitAppRegion: 'no-drag', '--wails-draggable': 'no-drag' } as any}
                      >
                          <Button
                            type="text"
                            icon={<TitleBarMinimizeIcon />}
                            className="titlebar-window-control-btn"
                            style={{ height: 40, borderRadius: 0, width: 40, position: 'relative' }}
                            onClick={WindowMinimise}
                          />
                          <Button
                            type="text"
                            icon={titleBarToggleIconKey === 'restore' ? <TitleBarRestoreIcon /> : <TitleBarMaximizeIcon />}
                            className="titlebar-window-control-btn"
                            style={{ height: 40, borderRadius: 0, width: 40, position: 'relative' }}
                            onClick={() => { void handleTitleBarWindowToggle(); }}
                          />
                          <Button
                            type="text"
                            icon={<TitleBarCloseIcon />}
                            danger
                            className="titlebar-close-btn titlebar-window-control-btn"
                            style={{ height: 40, borderRadius: 0, width: 40, position: 'relative' }}
                            onClick={() => { void handleApplicationQuitRequest(); }}
                          />
                      </div>
                  )}
              </div>
          </div>

          {showLinuxCJKFontBanner && (
              <LinuxCJKFontBanner
                darkMode={darkMode}
                installHint={linuxCJKFontInstallHint || ''}
                onOpenFontSettings={() => {
                        setThemeModalSection('appearance');
                        setIsThemeModalOpen(true);
                }}
                onDismiss={() => setIsLinuxCJKFontBannerDismissed(true)}
              />
          )}

          <Layout style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <Sider
            ref={siderRef}
            width={sidebarWidth}
            collapsible
            collapsed={isSidebarCollapsed}
            collapsedWidth={sidebarCollapsedWidth}
            trigger={null}
            data-sidebar-panel="true"
            data-sidebar-collapsed={isSidebarCollapsed}
            data-sidebar-actions-placement={isCollapsedSidebarActionsDocked ? 'titlebar' : 'fixed-rail'}
            className="gn-v2-app-sider"
            style={{
                borderRight: 'none',
                position: 'relative',
                background: 'var(--gn-bg-panel-2)',
                ['--gonavi-sidebar-collapsed-width' as any]: `${sidebarCollapsedWidth}px`,
                [sidebarResizeHit.cssVariable as any]: `${sidebarResizeHit.innerHitWidth}px`,
            }}
          >
            <div
                ref={sidebarContentRef}
                data-sidebar-content="true"
                aria-hidden={isCollapsedSidebarActionsDocked ? true : undefined}
                style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <div style={{ flex: 1, overflow: 'hidden', paddingBottom: 0, paddingRight: 0, position: 'relative' }}>
                    <div style={{ height: '100%', opacity: connectionWorkbenchState.ready ? 1 : 0.72, pointerEvents: connectionWorkbenchState.ready ? 'auto' : 'none' }}>
                        <ServiceTreeSidebar
                            onAddService={() => setIsAddServiceModalOpen(true)}
                        />
                    </div>
                    {!connectionWorkbenchState.ready && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 16,
                                background: darkMode ? 'rgba(7, 12, 20, 0.42)' : 'rgba(255, 255, 255, 0.58)',
                                backdropFilter: 'blur(4px)',
                                zIndex: 1,
                            }}
                        >
                            <div
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 14px',
                                    borderRadius: 999,
                                    background: darkMode ? 'rgba(15, 23, 36, 0.86)' : 'rgba(255, 255, 255, 0.94)',
                                    border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(22,32,51,0.08)',
                                    boxShadow: darkMode ? '0 12px 24px rgba(0,0,0,0.26)' : '0 12px 24px rgba(15,23,42,0.08)',
                                    color: darkMode ? 'rgba(255,255,255,0.88)' : '#162033',
                                    fontSize: 12,
                                    fontWeight: 500,
                                }}
                            >
                                <Spin size="small" />
                                <span>{connectionWorkbenchState.message}</span>
                            </div>
                        </div>
                    )}
                </div>


            </div>
            {!isSidebarCollapsed && <div
                data-sidebar-resize-handle="true"
                onMouseDown={handleSidebarMouseDown}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
                role="separator"
                aria-orientation="vertical"
                title={t('app.sidebar.resize_width')}
                style={{
                    position: 'absolute',
                    right: sidebarResizeHit.handleOffset,
                    top: 0,
                    bottom: 0,
                    width: sidebarResizeHit.handleWidth,
                    cursor: 'col-resize',
                    zIndex: 3,
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    background: 'transparent',
                }}
            />}
          </Sider>
           <Content
             style={{ background: 'var(--gn-bg-panel-2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}
           >
             <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row', position: 'relative' }}>
               <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'transparent', marginBottom: isLogPanelOpen ? 8 : 0, borderRadius: isLogPanelOpen ? 'var(--gonavi-border-radius)' : 0, clipPath: isLogPanelOpen ? 'inset(0 round var(--gonavi-border-radius))' : 'none' }}>
                  <TabManager onFocusSidebarSearch={handleFocusSidebarSearch} onAddService={() => setIsAddServiceModalOpen(true)} />
                  <FloatingWorkbenchWindows />
                              <NativeDetachedWindowController />
               </div>
             </div>

          </Content>
          </Layout>
          {isSettingsModalOpen && (() => {
            // 「数据目录」为顶层叶组（items 为空即渲染为不可展开的顶层行，
            // 点击经 resolveSettingsCenterGroupInitialPane 直达对应面板），与「关于」同级。
            const toolCenterGroups: SettingsCenterNavigationGroup[] = [
              {
                key: 'config',
                icon: <HddOutlined />,
                title: t('app.tools.entry.data_root.title'),
                description: t('app.tools.entry.data_root.description'),
                items: [],
              },
            ];
            const combinedSettingsCenterGroups = [
              ...settingsCenterGroups.filter((group) => group.key !== 'about'),
              ...toolCenterGroups,
              ...settingsCenterGroups.filter((group) => group.key === 'about'),
            ];
            const activeSettingsCenterGroup = combinedSettingsCenterGroups.find(
              (group) => group.key === activeSettingsCenterGroupKey,
            ) ?? combinedSettingsCenterGroups[0];
            const activeSettingsCenterTreeItemKey = activeSettingsCenterPane?.key === 'theme'
              ? `theme-${themeModalSection}`
              : (activeSettingsCenterPane?.key ?? null);
            const activeSettingsCenterPaneItem = activeSettingsCenterPane
              ? (
                  findSettingsCenterTreeItem(
                    combinedSettingsCenterGroups,
                    activeSettingsCenterPane.group,
                    activeSettingsCenterTreeItemKey,
                  )
                  ?? findSettingsCenterTreeItem(
                    combinedSettingsCenterGroups,
                    activeSettingsCenterPane.group,
                    activeSettingsCenterPane.key,
                  )
                )
              : null;
            const isActiveToolCenterPane = activeSettingsCenterPane
              ? isToolCenterGroupKey(activeSettingsCenterPane.group)
              : false;
            if (!activeSettingsCenterGroup) {
              return null;
            }
            const activateSettingsCenterGroup = (group: typeof combinedSettingsCenterGroups[number]) => {
              if (isToolCenterGroupKey(group.key)) {
                handleOpenToolsModal(group.key);
                return;
              }
              handleOpenSettingsModal(group.key);
            };
            const renderToolCenterPane = () => {
              if (!activeSettingsCenterPane || !isToolCenterGroupKey(activeSettingsCenterPane.group)) {
                return null;
              }

              if (activeSettingsCenterPane.key.startsWith('data-root')) {
                if (isWebRuntime) {
                  return renderDataDirectorySettings('application', true);
                }
                return (
                  <Modal
                    embedded
                    open
                    title={null}
                    closable={false}
                    onCancel={handleCancelSettingsCenterPane}
                    footer={[
                      <Button key="close" type="primary" onClick={handleCancelSettingsCenterPane}>
                        {t('common.close')}
                      </Button>,
                    ]}
                    styles={{
                      header: { background: 'transparent', borderBottom: 'none', paddingBottom: 8 },
                      body: { paddingTop: 8 },
                      footer: { background: 'transparent', borderTop: 'none', paddingTop: 10 },
                    }}
                  >
                    {renderDataDirectorySettings('application')}
                  </Modal>
                );
              }

              return null;
            };

            return (
              <SettingsCenterWorkbenchRegistrar>
                <div
                  className="gonavi-settings-center-modal gonavi-settings-center-workbench"
                  style={{
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'transparent',
                  }}
                >
                <div style={{ ...toolCenterModalWorkspaceStyle, flex: 1, minHeight: 0, padding: '4px 0 8px 8px' }}>
                    <div className="gonavi-settings-center-layout" style={toolCenterModalSplitStyle}>
                    <div className="gonavi-settings-center-groups" style={toolCenterNavPanelStyle}>
                      <SettingsCenterTreeNav
                        groups={combinedSettingsCenterGroups}
                        activeGroupKey={activeSettingsCenterGroup.key}
                        activeItemKey={activeSettingsCenterTreeItemKey}
                        darkMode={darkMode}
                        overlayTheme={overlayTheme}
                        ariaLabel={t('app.settings.title')}
                        onSelectGroup={(groupKey) => {
                          const group = combinedSettingsCenterGroups.find((entry) => entry.key === groupKey);
                          if (group) {
                            activateSettingsCenterGroup(group);
                          }
                        }}
                      />
                    </div>
                    <div
                      className="gonavi-settings-center-content"
                      style={toolCenterContentPanelStyle}
                    >
                      {activeSettingsCenterPane ? (
                        <div style={activeSettingsCenterDetailPanelStyle}>
                          {/* 侧栏树已显示当前项，内容区不再重复标题/说明 */}
                          <div
                            key={activeSettingsCenterPane.key}
                            style={isActiveToolCenterPane ? toolCenterDetailBodyStyle : settingsCenterDetailBodyStyle}
                          >
                            {isActiveToolCenterPane ? renderToolCenterPane() : renderSettingsCenterPane()}
                          </div>
                        </div>
                      ) : (
                        <div style={activeSettingsCenterDetailPanelStyle}>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <div style={{ fontSize: 'calc(var(--gn-font-size, 14px) * 1.14)', fontWeight: 700, color: overlayTheme.titleText }}>{activeSettingsCenterGroup.title}</div>
                            <div style={utilityMutedTextStyle}>{activeSettingsCenterGroup.description}</div>
                          </div>
                          <div style={{ flex: 1 }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </SettingsCenterWorkbenchRegistrar>
            );
          })()}
          {isDataRootModalOpen && (
          <Modal
            title={renderUtilityModalTitle(
              <HddOutlined />,
              t('app.data_root.title'),
              t('app.data_root.description'),
            )}
            open={isDataRootModalOpen}
            onCancel={() => {
              setIsDataRootModalOpen(false);
              setToolCenterBackGroupKey(null);
            }}
            footer={[
              <Button
                key="close"
                onClick={() => {
                  setIsDataRootModalOpen(false);
                  setToolCenterBackGroupKey(null);
                }}
              >
                {t('common.close')}
              </Button>,
              toolCenterBackGroupKey === 'config' ? (
                <Button
                  key="back"
                  onClick={() => handleReturnToToolCenter(() => setIsDataRootModalOpen(false))}
                >
                  {t('common.back_to_previous')}
                </Button>
              ) : null,
            ]}
            width={720}
            styles={{ content: utilityModalShellStyle, header: { background: 'transparent', borderBottom: 'none', paddingBottom: 8 }, body: { paddingTop: 8 }, footer: { background: 'transparent', borderTop: 'none', paddingTop: 10 } }}
          >
            {renderDataDirectorySettings()}
          </Modal>
          )}
          <UpdateReleaseNotesModal
              open={releaseNotesModalVisible}
              onClose={closeReleaseNotesModal}
              onOpen={handleReleaseNotesModalOpen}
              darkMode={darkMode}
              version={lastUpdateInfo?.latestVersion || updateDownloadProgress.version}
              channel={lastUpdateInfo?.channel}
              releaseName={lastUpdateInfo?.releaseName}
              releasePublishedAt={lastUpdateInfo?.releasePublishedAt}
              releaseNotes={lastUpdateInfo?.releaseNotes}
              releaseNotesUrl={lastUpdateInfo?.releaseNotesUrl || aboutInfo?.releaseUrl}
              zIndex={settingsChildModalZIndex}
              downloadProgress={
                  updateDownloadProgress.status === 'idle'
                      ? null
                      : {
                          status: updateDownloadProgress.status,
                          percent: updateDownloadProgress.percent,
                          downloaded: updateDownloadProgress.downloaded,
                          total: updateDownloadProgress.total,
                          message: updateDownloadProgress.message,
                      }
              }
              formatBytes={formatBytes}
              progressHint={
                  updateInstallAction === 'restart'
                      ? t('app.about.download_progress.complete_hint')
                      : t('app.about.download_progress.installer_complete_hint')
              }
              footerActions={[
                  lastUpdateInfo?.releaseNotesUrl || aboutInfo?.releaseUrl ? (
                      <Button
                          key="github"
                          onClick={() => {
                              const url = lastUpdateInfo?.releaseNotesUrl || aboutInfo?.releaseUrl;
                              if (!url) return;
                              try { BrowserOpenURL(url); } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
                          }}
                      >
                          {t('app.about.release_notes.modal.open_github')}
                      </Button>
                  ) : null,
                  (updateDownloadProgress.status === 'start' || updateDownloadProgress.status === 'downloading') ? (
                      <Button
                          key="background"
                          onClick={() => {
                              markUpdateProgressDismissed();
                              closeReleaseNotesModal();
                          }}
                      >
                          {t('app.about.action.hide_to_background')}
                      </Button>
                  ) : null,
                  lastUpdateInfo?.hasUpdate
                      && !isLatestUpdateDownloaded
                      && updateDownloadProgress.status !== 'start'
                      && updateDownloadProgress.status !== 'downloading' ? (
                      <Button
                          key="download"
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleDownloadUpdateWithNotes}
                      >
                          {updateDownloadActionLabel}
                      </Button>
                  ) : null,
                  isLatestUpdateDownloaded || updateDownloadProgress.status === 'done' ? (
                      <Button key="open-install-directory" onClick={openDownloadedUpdateDirectory}>
                          {t('app.about.action.open_install_directory')}
                      </Button>
                  ) : null,
                  isLatestUpdateDownloaded || updateDownloadProgress.status === 'done' ? (
                      <Button
                          key="restart"
                          type="primary"
                          icon={<SyncOutlined />}
                          onClick={() => { void handleInstallUpdateRequest(); }}
                      >
                          {updateInstallActionLabel}
                      </Button>
                  ) : null,
                  (updateDownloadProgress.status !== 'start' && updateDownloadProgress.status !== 'downloading') ? (
                      <Button key="close" onClick={closeReleaseNotesModal}>
                          {t('common.close')}
                      </Button>
                  ) : null,
              ].filter(Boolean) as React.ReactNode[]}
          />

          {isThemeModalOpen && (
          <Modal
              title={renderUtilityModalTitle(
                  themeModalSection === 'theme'
                      ? <SkinOutlined />
                      : <BgColorsOutlined />,
                  themeModalSection === 'theme'
                      ? t('app.theme.theme_settings_title')
                      : t('app.theme.appearance_settings_title'),
                  themeModalSection === 'theme'
                      ? t('app.theme.theme_settings_description')
                      : t('app.theme.appearance_settings_description')
              )}
              open={isThemeModalOpen}
              onCancel={() => { setIsThemeModalOpen(false); }}
              footer={null}
              width={820}
              styles={{ content: utilityModalShellStyle, header: { background: 'transparent', borderBottom: 'none', paddingBottom: 8 }, body: { paddingTop: 8, height: 620, overflow: 'hidden' }, footer: { background: 'transparent', borderTop: 'none', paddingTop: 10 } }}
          >
              {renderThemeSettingsContent()}
          </Modal>
          )}

          {showLinuxResizeHandles && (
              <>
                  {/* Linux Mint 下 frameless 仅局部可缩放：补四边四角命中层 */}
                  <div style={{ ...linuxResizeHandleStyleBase, top: 0, left: 14, right: 14, height: 6, cursor: 'ns-resize' }} />
                  <div style={{ ...linuxResizeHandleStyleBase, bottom: 0, left: 14, right: 14, height: 6, cursor: 'ns-resize' }} />
                  <div style={{ ...linuxResizeHandleStyleBase, top: 14, bottom: 14, left: 0, width: 6, cursor: 'ew-resize' }} />
                  <div style={{ ...linuxResizeHandleStyleBase, top: 14, bottom: 14, right: 0, width: 6, cursor: 'ew-resize' }} />

                  <div style={{ ...linuxResizeHandleStyleBase, top: 0, left: 0, width: 14, height: 14, cursor: 'nwse-resize' }} />
                  <div style={{ ...linuxResizeHandleStyleBase, top: 0, right: 0, width: 14, height: 14, cursor: 'nesw-resize' }} />
                  <div style={{ ...linuxResizeHandleStyleBase, bottom: 0, left: 0, width: 14, height: 14, cursor: 'nesw-resize' }} />
                  <div style={{ ...linuxResizeHandleStyleBase, bottom: 0, right: 0, width: 14, height: 14, cursor: 'nwse-resize' }} />
              </>
          )}

          <AddServiceModal open={isAddServiceModalOpen} onClose={() => setIsAddServiceModalOpen(false)} />
          <ManageServiceGroupsModal open={isManageServiceGroupsOpen} onClose={() => setIsManageServiceGroupsOpen(false)} />

          {/* Ghost Resize Line for Log Panel */}
          <div
              ref={logGhostRef}
              style={{
                  position: 'fixed',
                  left: renderedSidebarWidth, // Start from the rendered sidebar edge
                  right: 0,
                  height: '4px',
                  background: resizeGuideColor,
                  zIndex: 9999,
                  pointerEvents: 'none',
                  display: 'none',
                  cursor: 'row-resize'
              }}
          />
        </Layout>
    </ConfigProvider>
  );
}

export default App;
