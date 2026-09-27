import React from 'react';
import { readFileSync } from 'node:fs';
import { create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import TitleBarPrimaryActions, {
  resolveTitleBarPrimaryActionShortcut,
} from './TitleBarPrimaryActions';
import {
  cloneShortcutOptions,
  DEFAULT_SHORTCUT_OPTIONS,
} from '../utils/shortcuts';

const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const v2ThemeCss = readFileSync(new URL('../v2-theme.css', import.meta.url), 'utf8');

// Tooltip 走 rc-resize-observer，需要真实 DOM；这里只关心按钮结构，直接透传 children。
vi.mock('antd', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('@ant-design/icons', () => {
  const Icon = () => <span data-icon="true" />;
  return {
    ConsoleSqlOutlined: Icon,
    PlusOutlined: Icon,
    ApiOutlined: Icon,
    FolderOutlined: Icon,
    SettingOutlined: Icon,
  };
});

const buttonLabels = (buttons: any[]): string[] => buttons.map((button) => button.props['aria-label']);

const renderPrimaryActions = (overrides: Record<string, unknown> = {}) => create(
  <TitleBarPrimaryActions
    connectionGroupLabel="管理分组"
    onConnectionGroupManagement={vi.fn()}
    addServiceLabel="新增服务"
    onAddService={vi.fn()}
    dataRootLabel="数据目录"
    onDataRoot={vi.fn()}
    {...overrides}
  />,
);

describe('TitleBarPrimaryActions', () => {
  it('keeps the shared ghost treatment for every primary action', () => {
    const match = appCss.match(/\.gonavi-titlebar-primary-action\s*\{(?<body>[^}]*)\}/s);
    expect(match?.groups?.body).toContain('height: 32px;');
    expect(match?.groups?.body).toContain('border: 0;');
    expect(match?.groups?.body).toContain('border-radius: 7px;');
    expect(match?.groups?.body).toContain('font-weight: 600;');
    expect(match?.groups?.body).toContain('background: transparent');
    expect(match?.groups?.body).toContain('font-size: 13px;');
    expect(match?.groups?.body).toContain('-webkit-app-region: no-drag;');
    expect(match?.groups?.body).toContain('gap: 5px;');
    expect(appCss).not.toContain('.gonavi-titlebar-primary-action[data-titlebar-action-kind=');
    expect(appCss).not.toMatch(
      /\[(?:data-gonavi-new-query-action|data-gonavi-create-connection-action|data-gonavi-connection-group-management-action)[^\]]*\]/,
    );
    expect(appSource).toContain('data-titlebar-brand-toggle="true"');
    expect(appSource).toContain('brand/servdeck-icon.svg');
    expect(appSource).not.toContain('<span>ServDeck</span>');
  });

  it('drops every titlebar divider and groups actions with spacing only', () => {
    // 品牌后的竖线元素与主操作区右侧的 ::after 分隔线都已移除
    expect(appSource).not.toContain('gonavi-titlebar-brand-divider');
    expect(appCss).not.toMatch(/\.gonavi-titlebar-brand-divider\s*\{/s);
    expect(appCss).not.toMatch(/\.gonavi-titlebar-primary-actions::after\s*\{/s);
    // 分组改由间距承担：图标组内 2px，容器级 8px
    const iconGroupMatch = appCss.match(/\.gonavi-titlebar-icon-actions\s*\{(?<body>[^}]*)\}/s);
    expect(iconGroupMatch?.groups?.body).toContain('gap: 2px;');
    const actionsMatch = appCss.match(/\.gonavi-titlebar-primary-actions\s*\{(?<body>[^}]*)\}/s);
    expect(actionsMatch?.groups?.body).toContain('gap: 8px;');
    expect(actionsMatch?.groups?.body).toContain('margin-left: 8px;');
  });

  it('sizes icon actions to match the text actions and the brand logo', () => {
    const match = appCss.match(/\.gonavi-titlebar-icon-action\s*\{(?<body>[^}]*)\}/s);
    expect(match, 'Missing icon action rule').not.toBeNull();
    const body = match?.groups?.body ?? '';
    expect(body).toContain('width: 32px;');
    expect(body).toContain('height: 32px;');
    expect(body).toContain('border-radius: 7px;');
    expect(body).toContain('background: transparent');
    expect(body).toContain('-webkit-app-region: no-drag;');
    // 窄屏那条 width:auto 只该作用于文字按钮，图标按钮不能被压扁
    const narrowStart = appCss.indexOf('@media (max-width: 420px)');
    const narrowCss = appCss.slice(narrowStart);
    expect(narrowCss).toContain('.gonavi-titlebar-primary-action');
    expect(narrowCss).not.toContain('.gonavi-titlebar-icon-action');
  });

  it('keeps the custom window controls borderless under the v2 button theme', () => {
    const match = appCss.match(
      /\.titlebar-window-controls > \.ant-btn\.ant-btn-text\s*\{(?<body>[^}]*)\}/s,
    );
    expect(match, 'Missing titlebar window-control override').not.toBeNull();
    const body = match?.groups?.body ?? '';
    expect(body).toContain('border: 0 !important;');
    expect(body).toContain('border-radius: 8px !important;');
    expect(body).toContain('box-shadow: none !important;');

    const closeHoverMatch = appCss.match(
      /\.titlebar-window-controls > \.titlebar-close-btn\.ant-btn-text:hover\s*\{(?<body>[^}]*)\}/s,
    );
    expect(closeHoverMatch, 'Missing close-button hover override').not.toBeNull();
    expect(closeHoverMatch?.groups?.body).not.toContain('background'); // 红色由内缩 ::before 伪元素负责
    expect(closeHoverMatch?.groups?.body).toContain('color: #fff !important;');
    expect(appCss).toContain('body[data-ui-version="v2"] .gn-v2-titlebar .titlebar-window-controls > .ant-btn.ant-btn-text');
    expect(appCss).toContain('height: 100% !important;');
    const narrowStart = appCss.indexOf('@media (max-width: 420px)');
    const narrowEnd = appCss.indexOf("body[data-platform='windows']", narrowStart);
    const narrowCss = appCss.slice(narrowStart, narrowEnd);
    const narrowPrimaryRule = narrowCss.match(
      /body\[data-ui-version="v2"\] \.gonavi-titlebar-primary-action,\s*body\[data-ui-version="v2"\] \.gn-v2-titlebar-quick-action,\s*body\[data-ui-version="v2"\] \.gn-v2-titlebar-quick-more\s*\{(?<body>[^}]*)\}/s,
    );
    expect(narrowStart).toBeGreaterThanOrEqual(0);
    expect(narrowEnd).toBeGreaterThan(narrowStart);
    expect(narrowCss).toContain('Text-only titlebar actions stay readable instead of collapsing to empty icon buttons.');
    expect(narrowPrimaryRule?.groups?.body).toContain('width: auto !important;');
    expect(narrowPrimaryRule?.groups?.body).toContain('min-width: 0 !important;');
    expect(narrowPrimaryRule?.groups?.body).toContain('padding-inline: 4px !important;');
    expect(narrowPrimaryRule?.groups?.body).toContain('gap: 0 !important;');
    expect(narrowPrimaryRule?.groups?.body).toContain('font-size: 10px !important;');

    const titlebarMatch = v2ThemeCss.match(
      /body\[data-ui-version="v2"\] \.gn-v2-titlebar\s*\{(?<body>[^}]*)\}/s,
    );
    expect(titlebarMatch?.groups?.body).toContain('background: var(--gn-bg-titlebar) !important;');
    expect(titlebarMatch?.groups?.body).toContain('border: 0 !important;');
    expect(titlebarMatch?.groups?.body).toContain('box-shadow: none !important;');
  });

  it('keeps v2 actions compact and aligns native mac content to the traffic-light center', () => {
    const titlebarLayoutMatch = appCss.match(
      /body\[data-ui-version="v2"\] \.gn-v2-titlebar\s*\{(?<body>[^}]*)\}/s,
    );
    const titlebarLayout = titlebarLayoutMatch?.groups?.body ?? '';
    expect(titlebarLayout).toContain('display: flex !important;');
    expect(titlebarLayout).toContain('justify-content: flex-start;');
    expect(titlebarLayout).not.toContain('grid-template-columns:');
    const nativeMacRowRule = appCss.match(
      /\.gn-v2-titlebar-native-mac\s*>\s*\.gonavi-titlebar-leading,\s*body\[data-ui-version="v2"\] \.gn-v2-titlebar-native-mac\s*>\s*\.gn-v2-titlebar-right\s*\{(?<body>[^}]*)\}/s,
    );
    expect(nativeMacRowRule).not.toBeNull();
    expect(nativeMacRowRule?.groups?.body).toContain('top: var(--gn-titlebar-native-content-offset, 0px);');
    expect(appCss).not.toMatch(/\.gn-v2-titlebar-collapsed-docked[^{}]*\{[^}]*top:\s*-10px;/s);
    expect(appSource).toMatch(
      /--gn-titlebar-native-content-offset[^\n]*getMacNativeTitlebarContentOffset\(titleBarHeight, useNativeMacWindowControls\)/,
    );
    expect(appSource).toContain("isCollapsedSidebarActionsDocked ? 'gn-v2-titlebar-collapsed-docked' : ''");
    const collapsedActionBandRule = v2ThemeCss.match(
      /\.gn-v2-titlebar-collapsed-docked \.gn-v2-collapsed-sidebar-actions\s*\{(?<body>[^}]*)\}/s,
    );
    expect(collapsedActionBandRule).not.toBeNull();
    expect(collapsedActionBandRule?.groups?.body).toContain('bottom: 1px;');
    expect(collapsedActionBandRule?.groups?.body).not.toContain('--gn-titlebar-native-content-offset');
  });

  it('keeps the V2 explorer context text-only with three-line copy styles', () => {
    expect(v2ThemeCss).toContain('.gn-v2-explorer-context-line.is-connection');
    expect(v2ThemeCss).toContain('.gn-v2-explorer-context-line.is-database');
    expect(v2ThemeCss).toContain('.gn-v2-explorer-context-line.is-object');
    expect(v2ThemeCss).toContain('@container gn-v2-object-explorer (max-width: 300px)');
    expect(v2ThemeCss).not.toContain('.gn-v2-explorer-context-status');
    expect(v2ThemeCss).not.toContain('.gn-v2-explorer-context-status-dot');
    expect(v2ThemeCss).not.toContain('.gn-v2-titlebar-center');
  });

  it('keeps the V2 explorer context unclipped while the copy ellipsizes', () => {
    const centerRule = v2ThemeCss.match(
      /body\[data-ui-version="v2"\] \.gn-v2-explorer-context\s*\{(?<body>[^}]*)\}/s,
    );
    expect(centerRule?.groups?.body).toContain('overflow: visible;');
    const copyRule = v2ThemeCss.match(
      /body\[data-ui-version="v2"\] \.gn-v2-explorer-context-copy\s*\{(?<body>[^}]*)\}/s,
    );
    expect(copyRule?.groups?.body).toContain('overflow: hidden;');
    expect(copyRule?.groups?.body).toContain('flex-direction: column;');
    const lineRule = v2ThemeCss.match(
      /body\[data-ui-version="v2"\] \.gn-v2-explorer-context-line\s*\{(?<body>[^}]*)\}/s,
    );
    expect(lineRule?.groups?.body).toContain('min-height: 1em;');
    expect(lineRule?.groups?.body).toContain('text-overflow: ellipsis;');
    expect(v2ThemeCss).toContain('.gn-v2-tree-status.is-loading::before');
    expect(v2ThemeCss).toContain('.gn-v2-tree-status.is-success::before');
    expect(v2ThemeCss).toContain('.gn-v2-tree-status.is-error::before');
    expect(v2ThemeCss).not.toContain('.gn-v2-titlebar-live');
  });

  it('renders the three icon actions ahead of both text actions', () => {
    const onAddService = vi.fn();
    const onConnectionGroupManagement = vi.fn();
    const onDataRoot = vi.fn();
    const shortcutOptions = cloneShortcutOptions(DEFAULT_SHORTCUT_OPTIONS);
    const renderer = renderPrimaryActions({
      onAddService,
      onConnectionGroupManagement,
      onDataRoot,
    });

    const actions = renderer.root.findByProps({ 'data-titlebar-primary-actions': 'true' });
    expect(actions.props['data-no-titlebar-toggle']).toBe('true');
    const buttons = actions.findAllByType('button');
    expect(buttonLabels(buttons)).toEqual(['新增服务', '管理分组', '数据目录']);
    expect(buttons.map((button) => button.props.className)).toEqual([
      'gonavi-titlebar-icon-action',
      'gonavi-titlebar-icon-action',
      'gonavi-titlebar-icon-action',
    ]);
    expect(buttons.map((button) => button.props['data-gonavi-titlebar-icon-action'])).toEqual([
      'add-service',
      'connection-group',
      'data-root',
    ]);
    expect(buttons.map((button) => button.props.title)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);

    // 图标组是独立的一簇，靠 2px 间距收紧
    const iconGroup = actions.findAllByProps({ 'data-titlebar-icon-actions': 'true' });
    expect(iconGroup).toHaveLength(1);
    expect(iconGroup[0].findAllByType('button')).toHaveLength(3);

    buttons[0].props.onClick();
    buttons[1].props.onClick();
    buttons[2].props.onClick();
    expect(onAddService).toHaveBeenCalledTimes(1);
    expect(onConnectionGroupManagement).toHaveBeenCalledTimes(1);
    expect(onDataRoot).toHaveBeenCalledTimes(1);
  });

  it('hides icon actions whose label or handler is absent', () => {
    const renderer = create(
      <TitleBarPrimaryActions
        connectionGroupLabel="管理分组"
        onConnectionGroupManagement={vi.fn()}
        dataRootLabel="数据目录"
      />,
    );
    const actions = renderer.root.findByProps({ 'data-titlebar-primary-actions': 'true' });
    expect(buttonLabels(actions.findAllByType('button'))).toEqual(['管理分组']);
  });

  it('exposes a glyph for every icon action and a text span for every text action', () => {
    const renderer = renderPrimaryActions();
    const actions = renderer.root.findByProps({ 'data-titlebar-primary-actions': 'true' });
    const buttons = actions.findAllByType('button');
    expect(buttons).toHaveLength(3);
    // 两枚自定义 SVG 走 data-titlebar-glyph，管理分组沿用 antd 的 FolderOutlined
    expect(renderer.root.findAllByProps({ 'data-titlebar-glyph': 'true' })).toHaveLength(2);
    expect(buttons[1].findAllByProps({ 'data-icon': 'true' })).toHaveLength(1);
  });

  it('shows both Windows shortcut labels', () => {
    const shortcutOptions = cloneShortcutOptions(DEFAULT_SHORTCUT_OPTIONS);
    const renderer = renderPrimaryActions({
    });

    const buttons = renderer.root.findAllByType('button');
    expect(buttons.map((button) => button.props.title)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('uses current platform custom bindings and hides disabled shortcuts', () => {
    const shortcutOptions = cloneShortcutOptions(DEFAULT_SHORTCUT_OPTIONS);
    shortcutOptions.newQueryTab.mac = { combo: 'Meta+Alt+Q', enabled: true };
    shortcutOptions.newQueryTab.windows = { combo: 'Ctrl+Alt+W', enabled: true };
    shortcutOptions.newConnection.mac = { combo: 'Meta+Shift+C', enabled: false };
    shortcutOptions.newConnection.windows = { combo: 'Ctrl+Alt+C', enabled: true };

    expect(resolveTitleBarPrimaryActionShortcut(shortcutOptions, 'newQueryTab', 'mac')).toBe('⌘⌥Q');
    expect(resolveTitleBarPrimaryActionShortcut(shortcutOptions, 'newQueryTab', 'windows')).toBe('Ctrl+Alt+W');
    expect(resolveTitleBarPrimaryActionShortcut(shortcutOptions, 'newConnection', 'mac')).toBeUndefined();
    expect(resolveTitleBarPrimaryActionShortcut(shortcutOptions, 'newConnection', 'windows')).toBe('Ctrl+Alt+C');

    const renderer = renderPrimaryActions({
    });

    const buttons = renderer.root.findAllByType('button');
    expect(buttons.map((button) => button.props.title)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(buttonLabels(buttons)).toEqual(['新增服务', '管理分组', '数据目录']);
    expect(buttons.every((button) => button.props.disabled !== true)).toBe(true);
  });
});
