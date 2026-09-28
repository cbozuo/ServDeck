import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppstoreOutlined, FolderOpenOutlined, FolderOutlined, MenuUnfoldOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Tooltip, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { InputRef } from 'antd';
import { useI18n } from '../../i18n/provider';
import { APP_POPUP_Z_INDEX } from '../../utils/overlayZIndex';
import {
  resolveSidebarContextMenuPosition,
  resolveSidebarTreeRowKey,
  SIDEBAR_CONTEXT_MENU_FALLBACK_HEIGHT,
  SIDEBAR_CONTEXT_MENU_FALLBACK_WIDTH,
} from '../sidebarCoreUtils';
import { useServiceRegistryStore } from '../../serviceRegistryStore';
import {
  buildServiceTree,
  collectGroupKeys,
  findServiceTreeTarget,
  resolveServiceTemplate,
  type ServiceTreeMenuTarget,
} from './serviceTreeModel';
import { ServiceTreeContextMenu } from './ServiceTreeContextMenu';
import { ManageServiceGroupsModal } from './ManageServiceGroupsModal';
import './serviceTreeSidebar.css';

export interface ServiceTreeSidebarProps {
  onAddService: () => void;
  onExpandSidebar?: () => void;
  expandSidebarLabel?: string;
  expandSidebarButtonRef?: React.Ref<HTMLButtonElement>;
}

type ContextMenuState = {
  x: number;
  y: number;
  target: ServiceTreeMenuTarget;
};

const folderIcon = (
  <span className="gn-v2-tree-folder-icon" data-sidebar-tree-folder-icon="true">
    {/* 收起=闭合文件夹、展开=打开文件夹：两个都渲染，由 switcher 状态类切显隐 */}
    <FolderOutlined className="gn-folder-state-closed" />
    <FolderOpenOutlined className="gn-folder-state-open" />
  </span>
);

/**
 * 服务树里的图标：用户在外观 tab 挑过自定义图标就用它，否则回落到类型默认图标。
 */
const serviceIconOf = (serviceType: string, customIcon?: string): React.ReactNode => {
  if (customIcon) {
    return <img className="gst-service-icon" src={customIcon} alt="" />;
  }
  const template = resolveServiceTemplate(serviceType);
  if (!template) {
    return <AppstoreOutlined />;
  }
  return <img className="gst-service-icon" src={template.iconSrc} alt="" />;
};

/**
 * 左侧「纳管服务」树：分组（文件夹）+ 纳管的服务。
 * 数据源是 serviceRegistryStore（localStorage），分组能力对齐原数据库连接树：
 * 搜索过滤、右键菜单（移动分组 / 移除纳管 / 重命名 / 删除分组）、管理分组弹框。
 */
export const ServiceTreeSidebar: React.FC<ServiceTreeSidebarProps> = ({
  onAddService,
  onExpandSidebar,
  expandSidebarLabel,
  expandSidebarButtonRef,
}) => {
  const { t } = useI18n();
  const services = useServiceRegistryStore((state) => state.services);
  const groups = useServiceRegistryStore((state) => state.groups);
  const removeService = useServiceRegistryStore((state) => state.removeService);
  const moveServiceToGroup = useServiceRegistryStore((state) => state.moveServiceToGroup);
  const removeGroup = useServiceRegistryStore((state) => state.removeGroup);
  const renameGroup = useServiceRegistryStore((state) => state.renameGroup);

  const [filter, setFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<{ id: string; name: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const searchInputRef = useRef<InputRef | null>(null);
  const contextMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const doubleClickGuardRef = useRef<{ key: string; time: number } | null>(null);

  const tree = useMemo(() => buildServiceTree(services, groups, filter), [services, groups, filter]);
  const hasAnyService = services.length > 0;

  // 新建的分组自动展开；搜索时全部展开以便直接看到命中服务。
  useEffect(() => {
    const allGroupKeys = collectGroupKeys(tree);
    setExpandedKeys((prev) => {
      if (filter.trim()) {
        return allGroupKeys;
      }
      const known = new Set(prev);
      return [...prev, ...allGroupKeys.filter((key) => !known.has(key))];
    });
  }, [tree, filter]);

  // Ctrl+F / 标题栏搜索入口：聚焦侧栏搜索框（与数据库树同一事件约定）。
  useEffect(() => {
    const handleFocusSidebarSearch = () => {
      const inputEl = searchInputRef.current?.input as HTMLInputElement | undefined;
      if (!inputEl) return;
      inputEl.focus();
      inputEl.select();
    };
    window.addEventListener('gonavi:focus-sidebar-search', handleFocusSidebarSearch as EventListener);
    return () => {
      window.removeEventListener('gonavi:focus-sidebar-search', handleFocusSidebarSearch as EventListener);
    };
  }, []);

  // 右键菜单：点击外部 / Escape 关闭，并按视口边界修正位置。
  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && contextMenuPortalRef.current?.contains(target)) return;
      setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const frame = requestAnimationFrame(() => {
      const portal = contextMenuPortalRef.current;
      if (!portal) return;
      const position = resolveSidebarContextMenuPosition(contextMenu.x, contextMenu.y, {
        width: portal.offsetWidth || SIDEBAR_CONTEXT_MENU_FALLBACK_WIDTH,
        height: portal.offsetHeight || SIDEBAR_CONTEXT_MENU_FALLBACK_HEIGHT,
      });
      setContextMenu((prev) => (prev
        ? { ...prev, x: position.x, y: position.y }
        : prev));
    });
    return () => cancelAnimationFrame(frame);
  }, [contextMenu?.target, contextMenu?.x, contextMenu?.y]);

  const handleMoveService = useCallback((name: string, groupId: string | null) => {
    moveServiceToGroup(name, groupId);
    if (groupId) {
      setExpandedKeys((prev) => (prev.includes(`group:${groupId}`)
        ? prev
        : [...prev, `group:${groupId}`]));
    }
  }, [moveServiceToGroup]);

  const handleRemoveService = useCallback((name: string) => {
    const service = services.find((item) => item.name === name);
    Modal.confirm({
      title: t('service.tree.remove.confirm', { name: service?.displayName?.trim() || name }),
      okText: t('service.tree.remove.ok'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => removeService(name),
    });
  }, [removeService, services, t]);

  const handleDeleteGroup = useCallback((group: { id: string; name: string }) => {
    Modal.confirm({
      title: t('service.tree.group.deleteTitle'),
      content: t('service.tree.group.delete_confirm', { name: group.name }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => removeGroup(group.id),
    });
  }, [removeGroup, t]);

  const treeData = useMemo<DataNode[]>(() => {
    // nodeRef 统一为 ServiceTreeMenuTarget 结构（kind 判别），titleRender 与右键菜单共用。
    const toServiceDataNode = (serviceNode: { key: string; service: { name: string; serviceType: string; displayName?: string; iconDataUrl?: string } }): DataNode => ({
      key: serviceNode.key,
      title: serviceNode.service.displayName?.trim() || serviceNode.service.name,
      icon: serviceIconOf(serviceNode.service.serviceType, serviceNode.service.iconDataUrl),
      isLeaf: true,
      nodeRef: { kind: 'service', service: serviceNode.service },
      'data-sidebar-node-key': serviceNode.key,
    } as DataNode);
    const groupNodes: DataNode[] = tree.groups.map((groupNode) => ({
      key: groupNode.key,
      title: groupNode.group.name,
      icon: folderIcon,
      nodeRef: { kind: 'group', group: groupNode.group },
      'data-sidebar-node-key': groupNode.key,
      children: groupNode.services.map(toServiceDataNode),
    } as DataNode));
    const ungroupedNodes: DataNode[] = tree.ungrouped.map(toServiceDataNode);
    return [...groupNodes, ...ungroupedNodes];
  }, [tree]);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    const rowKey = resolveSidebarTreeRowKey(event.target);
    if (!rowKey) return;
    const target = findServiceTreeTarget(tree, rowKey);
    if (!target) return;
    event.preventDefault();
    setSelectedKey(rowKey);
    setContextMenu({ x: event.clientX, y: event.clientY, target });
  }, [tree]);

  /**
   * 展开交互对齐数据库树：展开/收起只由行首箭头单击承担；行主体双击才切换分组开合。
   * 双击落在箭头上时直接忽略（箭头自身的逐击切换已生效，再切换会叠加成偶数次翻转），
   * 另以 300ms 幂等守卫兜底同一分组的重复双击。
   */
  const handleNodeDoubleClick = useCallback((
    event: React.MouseEvent,
    node: { key?: React.Key },
  ) => {
    if ((event.target as HTMLElement | null)?.closest?.('.ant-tree-switcher')) return;
    const rowKey = String(node?.key ?? '');
    const target = findServiceTreeTarget(tree, rowKey);
    // 服务是叶子节点，双击暂无动作（后续接服务详情）。
    if (target?.kind !== 'group') return;
    const now = Date.now();
    if (doubleClickGuardRef.current
      && doubleClickGuardRef.current.key === rowKey
      && now - doubleClickGuardRef.current.time < 300) {
      return;
    }
    doubleClickGuardRef.current = { key: rowKey, time: now };
    setExpandedKeys((prev) => (prev.includes(rowKey)
      ? prev.filter((item) => item !== rowKey)
      : [...prev, rowKey]));
  }, [tree]);

  /**
   * 箭头点击也要获得与双击行一致的选中背景：展开/收起由 antd 处理，
   * 这里只把选中态同步到被点的行（事件捕获阶段，不拦截 antd 的展开动作）。
   */
  const handleTreeClickCapture = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest?.('.ant-tree-switcher')) return;
    const rowKey = resolveSidebarTreeRowKey(target);
    if (rowKey) {
      setSelectedKey(rowKey);
    }
  }, []);

  const emptyState = !hasAnyService
    ? (
      <div className="gst-empty" data-service-tree-empty="true">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('service.tree.empty.title')} />
        <Button type="primary" icon={<PlusOutlined />} onClick={onAddService}>
          {t('service.tree.add_service')}
        </Button>
        <div className="gst-empty-hint">{t('service.tree.empty.hint')}</div>
      </div>
    )
    : tree.empty
      ? (
        <div className="gst-empty" data-service-tree-no-match="true">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('service.tree.no_match')} />
        </div>
      )
      : null;

  return (
    <div className="gn-v2-sidebar-redesign" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <aside
        className="gn-v2-connection-rail"
        data-sidebar-fixed-rail="true"
        aria-label={t('service.tree.rail.label')}
      >
        <div className="gn-v2-rail-items">
          <div className="gn-v2-rail-primary-actions" aria-label={t('service.tree.rail.label')}>
            {onExpandSidebar && expandSidebarLabel && (
              <div className="gn-v2-rail-sidebar-toggle-slot">
                <Tooltip title={expandSidebarLabel} placement="right" mouseEnterDelay={0.35}>
                  <button
                    ref={expandSidebarButtonRef}
                    type="button"
                    className="gn-v2-rail-tool gn-v2-rail-sidebar-toggle"
                    data-sidebar-collapse-trigger="true"
                    data-sidebar-toggle-placement="fixed-rail"
                    aria-label={expandSidebarLabel}
                    aria-controls="gonavi-sidebar-tree-panel"
                    onClick={onExpandSidebar}
                  >
                    <MenuUnfoldOutlined />
                  </button>
                </Tooltip>
              </div>
            )}
            <Tooltip title={t('service.tree.add_service')} placement="right" mouseEnterDelay={0.35}>
              <button
                type="button"
                className="gn-v2-rail-tool"
                data-service-tree-add-action="true"
                aria-label={t('service.tree.add_service')}
                onClick={onAddService}
              >
                <PlusOutlined />
              </button>
            </Tooltip>
            <Tooltip title={t('service.tree.groups.manage')} placement="right" mouseEnterDelay={0.35}>
              <button
                type="button"
                className="gn-v2-rail-tool"
                data-service-tree-manage-groups="true"
                aria-label={t('service.tree.groups.manage')}
                onClick={() => setIsManageGroupsOpen(true)}
              >
                <FolderOpenOutlined />
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>

      <div
        id="gonavi-sidebar-tree-panel"
        className="gn-v2-object-explorer"
        data-sidebar-tree-panel="true"
        data-service-tree-panel="true"
        style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, flex: 1 }}
      >
        <div
          className="gn-v2-explorer-search"
          style={{ padding: '8px 14px 4px' }}
        >
          <div className="gn-v2-explorer-filter-row" data-v2-sidebar-search-mode="filter">
            <Input
              ref={searchInputRef}
              value={filter}
              placeholder={t('service.tree.search.placeholder')}
              onChange={(event) => setFilter(event.target.value)}
              size="small"
              prefix={<SearchOutlined />}
              allowClear
            />
            <Tooltip title={t('service.tree.filter.reset')}>
              <button
                type="button"
                className="gn-v2-explorer-filter-action"
                aria-label={t('service.tree.filter.reset')}
                disabled={!filter}
                onClick={() => setFilter('')}
              >
                <ReloadOutlined />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="gst-all-services-row" data-service-tree-all-row="true" data-sidebar-explorer-actions="true">
          <AppstoreOutlined className="gst-all-services-icon" />
          <span className="gst-panel-title">{t('service.tree.title')}</span>
          <span className="gst-panel-title-spring" />
          <span className="gst-panel-count" data-service-tree-count="true">
            {services.length}
          </span>
        </div>

        <div
          className="sidebar-tree-scroll-shell gn-v2-explorer-tree-shell"
          style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}
          onClickCapture={handleTreeClickCapture}
        >
          <div className="sidebar-tree-scroll-content">
            {emptyState}
            {!emptyState && (
              <Tree
                showIcon
                blockNode
                motion={false}
                treeData={treeData}
                selectedKeys={selectedKey ? [selectedKey] : []}
                onSelect={(keys) => setSelectedKey(keys.length > 0 ? String(keys[0]) : '')}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                onDoubleClick={handleNodeDoubleClick}
                onContextMenu={handleContextMenu}
                titleRender={(node) => {
                  const target = (node as { nodeRef?: ServiceTreeMenuTarget }).nodeRef;
                  if (!target) {
                    return <span className="gn-v2-tree-title gst-node-title">{String(node.title)}</span>;
                  }
                  if (target.kind === 'group') {
                    return (
                      <span className="gn-v2-tree-title gst-node-title" data-service-tree-group-title="true">
                        <span className="gst-node-name">{target.group.name}</span>
                        <span className="gst-node-count">
                          {t('service.tree.groups.count', { count: services.filter((item) => item.groupId === target.group.id).length })}
                        </span>
                      </span>
                    );
                  }
                  return (
                    <span className="gn-v2-tree-title gst-node-title" data-service-tree-service-title="true">
                      <span className="gst-node-name">
                        {target.service.displayName?.trim() || target.service.name}
                      </span>
                    </span>
                  );
                }}
              />
            )}
          </div>
        </div>
      </div>

      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={contextMenuPortalRef}
          className="gn-v2-sidebar-context-menu-portal"
          data-service-tree-context-menu-portal="true"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: APP_POPUP_Z_INDEX,
            width: SIDEBAR_CONTEXT_MENU_FALLBACK_WIDTH,
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <ServiceTreeContextMenu
            target={contextMenu.target}
            groups={groups}
            onClose={() => setContextMenu(null)}
            onMoveService={handleMoveService}
            onRemoveService={handleRemoveService}
            onRenameGroup={(group) => {
              setRenamingGroup(group);
              setRenameDraft(group.name);
            }}
            onDeleteGroup={handleDeleteGroup}
          />
        </div>,
        document.body,
      )}

      <ManageServiceGroupsModal
        open={isManageGroupsOpen}
        onClose={() => setIsManageGroupsOpen(false)}
      />

      <Modal
        open={Boolean(renamingGroup)}
        title={t('service.tree.rename.title')}
        okText={t('common.ok')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !renameDraft.trim() }}
        destroyOnHidden
        onOk={() => {
          if (renamingGroup && renameDraft.trim()) {
            renameGroup(renamingGroup.id, renameDraft.trim());
          }
          setRenamingGroup(null);
        }}
        onCancel={() => setRenamingGroup(null)}
      >
        <Input
          value={renameDraft}
          maxLength={40}
          autoFocus
          placeholder={t('service.tree.group.name.placeholder')}
          onChange={(event) => setRenameDraft(event.target.value)}
          onPressEnter={() => {
            if (renamingGroup && renameDraft.trim()) {
              renameGroup(renamingGroup.id, renameDraft.trim());
            }
            setRenamingGroup(null);
          }}
        />
      </Modal>
    </div>
  );
};
