import type { TabData } from '../types';
import { t as catalogTranslate } from '../i18n/catalog';
import type { I18nParams } from '../i18n/types';
import { useServiceRegistryStore } from '../serviceRegistryStore';

export const TAB_DISPLAY_ELEMENT_KEYS = ['object', 'kind'] as const;

export type TabDisplayElementKey = typeof TAB_DISPLAY_ELEMENT_KEYS[number];
export type TabDisplayLayout = 'single' | 'double';

export interface TabDisplayLayoutSnapshot {
  primaryElements: TabDisplayElementKey[];
  secondaryElements: TabDisplayElementKey[];
}

export interface TabDisplaySettings {
  layout: TabDisplayLayout;
  primaryElements: TabDisplayElementKey[];
  secondaryElements: TabDisplayElementKey[];
  single?: TabDisplayLayoutSnapshot;
  double?: TabDisplayLayoutSnapshot;
}

export type TabDisplayTranslate = (key: string, params?: I18nParams) => string;

const defaultTranslate: TabDisplayTranslate = (key, params) => catalogTranslate('en-US', key, params);

export const TAB_DISPLAY_SECONDARY_DEFAULT_KEYS: TabDisplayElementKey[] = ['kind'];

export const TAB_DISPLAY_ELEMENT_META: Record<TabDisplayElementKey, { labelKey: string; descriptionKey: string }> = {
  kind: {
    labelKey: 'app.theme.tab_display.element.kind.label',
    descriptionKey: 'app.theme.tab_display.element.kind.description',
  },
  object: {
    labelKey: 'app.theme.tab_display.element.object.label',
    descriptionKey: 'app.theme.tab_display.element.object.description',
  },
};

const DEFAULT_SINGLE_TAB_DISPLAY_SNAPSHOT: TabDisplayLayoutSnapshot = {
  primaryElements: ['object'],
  secondaryElements: [],
};

const DEFAULT_DOUBLE_TAB_DISPLAY_SNAPSHOT: TabDisplayLayoutSnapshot = {
  primaryElements: ['object'],
  secondaryElements: ['kind'],
};

export const DEFAULT_TAB_DISPLAY_SETTINGS: TabDisplaySettings = {
  layout: 'double',
  primaryElements: [...DEFAULT_DOUBLE_TAB_DISPLAY_SNAPSHOT.primaryElements],
  secondaryElements: [...DEFAULT_DOUBLE_TAB_DISPLAY_SNAPSHOT.secondaryElements],
};

export const getCurrentTabDisplaySnapshot = (settings: TabDisplaySettings): TabDisplayLayoutSnapshot => ({
  primaryElements: [...settings.primaryElements],
  secondaryElements: [...settings.secondaryElements],
});

export const getDefaultTabDisplaySnapshot = (layout: TabDisplayLayout): TabDisplayLayoutSnapshot => {
  const snapshot = layout === 'single'
    ? DEFAULT_SINGLE_TAB_DISPLAY_SNAPSHOT
    : DEFAULT_DOUBLE_TAB_DISPLAY_SNAPSHOT;
  return {
    primaryElements: [...snapshot.primaryElements],
    secondaryElements: [...snapshot.secondaryElements],
  };
};

export const getSavedTabDisplaySnapshot = (
  settings: TabDisplaySettings,
  layout: TabDisplayLayout,
): TabDisplayLayoutSnapshot => {
  const saved = settings[layout];
  if (saved) {
    return {
      primaryElements: [...saved.primaryElements],
      secondaryElements: [...saved.secondaryElements],
    };
  }
  if (settings.layout === layout) {
    return getCurrentTabDisplaySnapshot(settings);
  }
  return getDefaultTabDisplaySnapshot(layout);
};

export const applyTabDisplaySettingsPatch = (
  currentSettings: TabDisplaySettings,
  patch: Partial<TabDisplaySettings>,
): TabDisplaySettings => {
  const nextSettings = sanitizeTabDisplaySettings({
    ...currentSettings,
    ...patch,
  });
  const nextSnapshot = getCurrentTabDisplaySnapshot(nextSettings);
  return sanitizeTabDisplaySettings({
    ...nextSettings,
    [nextSettings.layout]: nextSnapshot,
  });
};

export const switchTabDisplayLayout = (
  currentSettings: TabDisplaySettings,
  layout: TabDisplayLayout,
): TabDisplaySettings => {
  if (layout === currentSettings.layout) {
    return sanitizeTabDisplaySettings(currentSettings);
  }
  const currentSnapshot = getCurrentTabDisplaySnapshot(currentSettings);
  const targetSnapshot = getSavedTabDisplaySnapshot(currentSettings, layout);
  return sanitizeTabDisplaySettings({
    ...currentSettings,
    [currentSettings.layout]: currentSnapshot,
    layout,
    primaryElements: targetSnapshot.primaryElements,
    secondaryElements: targetSnapshot.secondaryElements,
    [layout]: targetSnapshot,
  });
};

const isTabDisplayElementKey = (value: unknown): value is TabDisplayElementKey => (
  typeof value === 'string' && (TAB_DISPLAY_ELEMENT_KEYS as readonly string[]).includes(value)
);

const sanitizeTabDisplayElementList = (
  value: unknown,
  used: Set<TabDisplayElementKey>,
): TabDisplayElementKey[] => {
  if (!Array.isArray(value)) return [];
  const result: TabDisplayElementKey[] = [];
  value.forEach((entry) => {
    if (!isTabDisplayElementKey(entry) || used.has(entry)) return;
    used.add(entry);
    result.push(entry);
  });
  return result;
};

const sanitizeTabDisplayLayoutSnapshot = (
  value: unknown,
  layout: TabDisplayLayout,
): TabDisplayLayoutSnapshot | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<TabDisplayLayoutSnapshot>;
  const used = new Set<TabDisplayElementKey>();
  const primaryElements = sanitizeTabDisplayElementList(raw.primaryElements, used);
  const secondaryElements = sanitizeTabDisplayElementList(raw.secondaryElements, used);
  const fallback = getDefaultTabDisplaySnapshot(layout);
  return {
    primaryElements: primaryElements.length > 0 ? primaryElements : fallback.primaryElements,
    secondaryElements,
  };
};

export const sanitizeTabDisplaySettings = (value: unknown): TabDisplaySettings => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_TAB_DISPLAY_SETTINGS, primaryElements: [...DEFAULT_TAB_DISPLAY_SETTINGS.primaryElements], secondaryElements: [...DEFAULT_TAB_DISPLAY_SETTINGS.secondaryElements] };
  }
  const raw = value as Partial<TabDisplaySettings>;
  const layout = raw.layout === 'single' || raw.layout === 'double'
    ? raw.layout
    : DEFAULT_TAB_DISPLAY_SETTINGS.layout;
  const fallback = getDefaultTabDisplaySnapshot(layout);
  const used = new Set<TabDisplayElementKey>();
  const primaryElements = sanitizeTabDisplayElementList(raw.primaryElements, used);
  const secondaryElements = sanitizeTabDisplayElementList(raw.secondaryElements, used);
  const result: TabDisplaySettings = {
    layout,
    primaryElements: primaryElements.length > 0 ? primaryElements : fallback.primaryElements,
    secondaryElements,
  };
  const single = sanitizeTabDisplayLayoutSnapshot(raw.single, 'single');
  const double = sanitizeTabDisplayLayoutSnapshot(raw.double, 'double');
  if (single) {
    result.single = single;
  }
  if (double) {
    result.double = double;
  }
  return result;
};

export const resolveTabDisplayElementOrder = (settings?: Partial<TabDisplaySettings> | null): TabDisplayElementKey[] => {
  const sanitized = sanitizeTabDisplaySettings(settings);
  const visible = [...sanitized.primaryElements, ...sanitized.secondaryElements];
  return [
    ...visible,
    ...TAB_DISPLAY_ELEMENT_KEYS.filter((key) => !visible.includes(key)),
  ];
};

export const getTabDisplayKindLabel = (tab: TabData): string => {
  // 设置中心：标题已表意，不再叠加英文类型角标（用户反馈）
  if (tab.type === 'settings-center') return '';
  // 服务详情：服务名已是完整标题，去掉 SVC 缩写角标
  if (tab.type === 'service-detail') return '';
  // 服务总览：标题「服务总览」已表意，不叠 TAB 角标
  if (tab.type === 'service-home') return '';
  if (tab.type.startsWith('jvm')) return 'JVM';
  return 'TAB';
};

const buildCompactObjectTabTitle = (tab: TabData, translate: TabDisplayTranslate = defaultTranslate): string => {
  if (tab.type === 'settings-center') {
    return translate('app.settings.title');
  }
  if (tab.type === 'service-detail') {
    // 页签标题显示「显示名称」而非服务标识：优先取注册服务的 displayName，找不到再回落 serviceName/title。
    const name = tab.serviceName || tab.title;
    const displayName = useServiceRegistryStore
      .getState()
      .services.find((entry) => entry.name === name)?.displayName;
    return (displayName && displayName.trim()) || name;
  }
  return tab.title;
};

const getTabDisplayElementValue = (
  key: TabDisplayElementKey,
  tab: TabData,
  translate: TabDisplayTranslate = defaultTranslate,
): string => {
  switch (key) {
    case 'kind':
      return getTabDisplayKindLabel(tab);
    case 'object':
      return buildCompactObjectTabTitle(tab, translate);
    default:
      return '';
  }
};

const formatTabDisplayPartValue = (_key: TabDisplayElementKey, value: string): string => {
  if (!value) return '';
  return value;
};

export interface TabDisplayPart {
  key: TabDisplayElementKey;
  value: string;
  text: string;
}

export interface TabDisplayModel {
  layout: TabDisplayLayout;
  primaryParts: TabDisplayPart[];
  secondaryParts: TabDisplayPart[];
  primaryText: string;
  secondaryText: string;
  fullTitle: string;
}

const buildTabDisplayParts = (
  keys: TabDisplayElementKey[],
  tab: TabData,
  translate: TabDisplayTranslate = defaultTranslate,
): TabDisplayPart[] => keys
  .map((key) => {
    const value = getTabDisplayElementValue(key, tab, translate);
    return {
      key,
      value,
      text: formatTabDisplayPartValue(key, value),
    };
  })
  .filter((part) => part.text);

export const buildTabDisplayModel = (
  tab: TabData,
  settings?: Partial<TabDisplaySettings> | null,
  translate: TabDisplayTranslate = defaultTranslate,
): TabDisplayModel => {
  const sanitized = sanitizeTabDisplaySettings(settings);
  const primaryParts = buildTabDisplayParts(sanitized.primaryElements, tab, translate);
  const secondaryParts = buildTabDisplayParts(sanitized.secondaryElements, tab, translate);
  const primaryText = primaryParts.map((part) => part.text).join(' ').trim() || buildCompactObjectTabTitle(tab, translate);
  // 服务详情是单实体 tab：双行徽标只会剩一个孤立的 kind 短标，固定单行。
  const singleEntityTab = tab.type === 'service-detail';
  const layout: TabDisplayLayout = singleEntityTab ? 'single' : sanitized.layout;
  const effectiveSecondaryParts = singleEntityTab ? [] : secondaryParts;
  const secondaryText = effectiveSecondaryParts.map((part) => part.text).join('·').trim();
  const fullTitle = [primaryText, secondaryText].filter(Boolean).join(' · ');
  return {
    layout,
    primaryParts,
    secondaryParts: effectiveSecondaryParts,
    primaryText,
    secondaryText,
    fullTitle,
  };
};

export const buildTabDisplayTitle = (
  tab: TabData,
  settings?: Partial<TabDisplaySettings> | null,
  translate: TabDisplayTranslate = defaultTranslate,
): string => {
  if (settings) {
    return buildTabDisplayModel(tab, settings, translate).fullTitle;
  }
  return buildCompactObjectTabTitle(tab, translate);
};
