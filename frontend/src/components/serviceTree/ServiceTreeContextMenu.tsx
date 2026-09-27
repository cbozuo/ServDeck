import React from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { useI18n } from '../../i18n/provider';
import type { ManagedServiceGroup } from '../../serviceRegistryStore';
import type { ServiceTreeMenuTarget } from './serviceTreeModel';

export type { ServiceTreeMenuTarget };

type MenuItemConfig = {
  action: string;
  icon: React.ReactNode;
  title: string;
  kbd?: string;
  selected?: boolean;
  danger?: boolean;
};

const MenuButton: React.FC<{ item: MenuItemConfig; onAction: (action: string) => void }> = ({ item, onAction }) => (
  <button
    type="button"
    className={[
      'gn-v2-context-menu-item',
      item.selected ? 'is-selected' : '',
      item.danger ? 'is-danger' : '',
    ].filter(Boolean).join(' ')}
    role="menuitem"
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onAction(item.action);
    }}
  >
    <span className="gn-v2-context-menu-item-icon">{item.icon}</span>
    <span className="gn-v2-context-menu-item-title">{item.title}</span>
    {item.kbd && <span className="gn-v2-context-menu-kbd">{item.kbd}</span>}
  </button>
);

/**
 * 纳管服务树右键菜单（复用 v2 侧栏菜单样式类）。
 * 服务：移动到分组 / 移出分组 / 移除纳管；分组：重命名 / 删除。
 */
export const ServiceTreeContextMenu: React.FC<{
  target: ServiceTreeMenuTarget;
  groups: ManagedServiceGroup[];
  onClose: () => void;
  onMoveService: (name: string, groupId: string | null) => void;
  onRemoveService: (name: string) => void;
  onRenameGroup: (group: ManagedServiceGroup) => void;
  onDeleteGroup: (group: ManagedServiceGroup) => void;
}> = ({ target, groups, onClose, onMoveService, onRemoveService, onRenameGroup, onDeleteGroup }) => {
  const { t } = useI18n();

  const handleAction = (action: string) => {
    onClose();
    if (action === 'remove') {
      if (target.kind === 'service') onRemoveService(target.service.name);
      return;
    }
    if (action === 'rename-group') {
      if (target.kind === 'group') onRenameGroup(target.group);
      return;
    }
    if (action === 'delete-group') {
      if (target.kind === 'group') onDeleteGroup(target.group);
      return;
    }
    if (action === 'move-to-ungrouped') {
      if (target.kind === 'service') onMoveService(target.service.name, null);
      return;
    }
    if (action.startsWith('move-to-group:')) {
      if (target.kind === 'service') onMoveService(target.service.name, action.slice('move-to-group:'.length));
    }
  };

  const displayName = target.kind === 'service'
    ? (target.service.displayName?.trim() || target.service.name)
    : target.group.name;
  const meta = target.kind === 'service'
    ? t('service.tree.menu.serviceMeta', { name: target.service.name })
    : t('service.tree.menu.groupMeta');

  const renderItems = (items: MenuItemConfig[]) => items.map((item) => (
    <MenuButton key={item.action} item={item} onAction={handleAction} />
  ));

  if (target.kind === 'group') {
    return (
      <div className="gn-v2-table-context-menu gn-service-tree-context-menu" data-service-tree-context-menu="true" role="menu">
        <div className="gn-v2-context-menu-header">
          <span className="gn-v2-context-menu-table-icon"><FolderOpenOutlined /></span>
          <span className="gn-v2-context-menu-heading">
            <strong title={displayName}>{displayName}</strong>
            <small>{meta}</small>
          </span>
          <span className="gn-v2-context-menu-engine-pill">{t('service.tree.menu.groupPill')}</span>
        </div>
        <div className="gn-v2-context-menu-body">
          {renderItems([
            { action: 'rename-group', icon: <EditOutlined />, title: t('service.tree.menu.rename'), kbd: 'F2' },
          ])}
          <div className="gn-v2-context-menu-divider" />
          {renderItems([
            { action: 'delete-group', icon: <DeleteOutlined />, title: t('service.tree.menu.deleteGroup'), danger: true, kbd: '⌫' },
          ])}
        </div>
      </div>
    );
  }

  const service = target.service;
  const currentGroupId = service.groupId;
  const hasGroup = Boolean(currentGroupId && groups.some((group) => group.id === currentGroupId));

  return (
    <div className="gn-v2-table-context-menu gn-service-tree-context-menu" data-service-tree-context-menu="true" role="menu">
      <div className="gn-v2-context-menu-header">
        <span className="gn-v2-context-menu-table-icon"><FolderOpenOutlined /></span>
        <span className="gn-v2-context-menu-heading">
          <strong title={displayName}>{displayName}</strong>
          <small>{meta}</small>
        </span>
        <span className="gn-v2-context-menu-engine-pill">{t('service.tree.menu.servicePill')}</span>
      </div>
      <div className="gn-v2-context-menu-body">
        {groups.length > 0 && (
          <>
            <div className="gn-v2-context-menu-section-title">{t('service.tree.menu.groupSection')}</div>
            {renderItems([
              ...groups.map((group): MenuItemConfig => ({
                action: `move-to-group:${group.id}`,
                icon: group.id === currentGroupId ? <FolderOpenOutlined /> : <FolderOutlined />,
                title: group.name,
                kbd: group.id === currentGroupId ? t('service.tree.menu.current') : undefined,
                selected: group.id === currentGroupId,
              })),
              ...(hasGroup ? [{
                action: 'move-to-ungrouped',
                icon: <FolderOpenOutlined />,
                title: t('service.tree.menu.moveToUngrouped'),
              }] : []),
            ])}
          </>
        )}
        <div className="gn-v2-context-menu-divider" />
        {renderItems([
          { action: 'remove', icon: <DeleteOutlined />, title: t('service.tree.menu.remove'), danger: true, kbd: '⌫' },
        ])}
      </div>
    </div>
  );
};
