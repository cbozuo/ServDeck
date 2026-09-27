import React from 'react';
import { Tooltip } from 'antd';
import {
  ApiOutlined,
  FolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  getShortcutDisplayLabel,
  resolveShortcutBinding,
  type ShortcutOptions,
  type ShortcutPlatform,
} from '../utils/shortcuts';
import { TitleBarAddServiceIcon, TitleBarDataRootIcon } from './titlebarIcons';

type TitleBarPrimaryShortcutAction = 'newQueryTab' | 'newConnection';

export const resolveTitleBarPrimaryActionShortcut = (
  shortcutOptions: Partial<ShortcutOptions> | null | undefined,
  action: TitleBarPrimaryShortcutAction,
  platform: ShortcutPlatform,
): string | undefined => {
  const binding = resolveShortcutBinding(shortcutOptions, action, platform);
  return binding.enabled && binding.combo
    ? getShortcutDisplayLabel(binding.combo, platform)
    : undefined;
};

/**
 * 图标按钮内的字形尺寸。品牌 Logo 是 20px 的实心渐变图形，
 * 描边图标取 18px 才能在它旁边压得住，同时不与文字按钮里 16px 的 antd 图标抢视线。
 */
const ICON_GLYPH_SIZE = 18;

/** 图标化入口完全隐藏了名称，浮层是唯一出口，延迟不能沿用文字按钮的 0.75s。 */
const ICON_TOOLTIP_DELAY_SECONDS = 0.35;

interface TitleBarPrimaryActionsProps {
  newQueryShortcut?: string;
  newConnectionShortcut?: string;
  addServiceLabel?: string;
  onAddService?: () => void;
  connectionGroupLabel?: string;
  onConnectionGroupManagement?: () => void;
  dataRootLabel?: string;
  onDataRoot?: () => void;
}

const getActionTitle = (label: string, shortcut?: string): string => (
  shortcut ? `${label} \u00b7 ${shortcut}` : label
);

interface IconActionSpec {
  key: string;
  label: string;
  icon: React.ReactNode;
  attr: string;
  onClick: () => void;
}

const renderIconAction = ({ key, label, icon, attr, onClick }: IconActionSpec) => (
  <Tooltip
    key={key}
    title={label}
    placement="bottom"
    mouseEnterDelay={ICON_TOOLTIP_DELAY_SECONDS}
  >
    <button
      type="button"
      className="gonavi-titlebar-icon-action"
      aria-label={label}
      data-gonavi-titlebar-icon-action={attr}
      onClick={onClick}
    >
      {icon}
    </button>
  </Tooltip>
);

const TitleBarPrimaryActions: React.FC<TitleBarPrimaryActionsProps> = ({
  addServiceLabel,
  onAddService,
  connectionGroupLabel,
  onConnectionGroupManagement,
  dataRootLabel,
  onDataRoot,
}) => {
  const iconActions: IconActionSpec[] = [];
  if (addServiceLabel && onAddService) {
    iconActions.push({
      key: 'add-service',
      label: addServiceLabel,
      icon: <TitleBarAddServiceIcon style={{ fontSize: ICON_GLYPH_SIZE }} />,
      attr: 'add-service',
      onClick: onAddService,
    });
  }
  if (connectionGroupLabel && onConnectionGroupManagement) {
    iconActions.push({
      key: 'connection-group',
      label: connectionGroupLabel,
      icon: <FolderOutlined style={{ fontSize: ICON_GLYPH_SIZE }} />,
      attr: 'connection-group',
      onClick: onConnectionGroupManagement,
    });
  }
  if (dataRootLabel && onDataRoot) {
    iconActions.push({
      key: 'data-root',
      label: dataRootLabel,
      icon: <TitleBarDataRootIcon style={{ fontSize: ICON_GLYPH_SIZE }} />,
      attr: 'data-root',
      onClick: onDataRoot,
    });
  }

  return (
    <div
      className="gonavi-titlebar-primary-actions"
      data-titlebar-primary-actions="true"
      data-no-titlebar-toggle="true"
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {iconActions.length > 0 && (
        <div className="gonavi-titlebar-icon-actions" data-titlebar-icon-actions="true">
          {iconActions.map(renderIconAction)}
        </div>
      )}
    </div>
  );
};

export default TitleBarPrimaryActions;
