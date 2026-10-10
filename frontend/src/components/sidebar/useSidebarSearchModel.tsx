import React, { useCallback, useEffect, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  BarsOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  EyeOutlined,
  KeyOutlined,
  LinkOutlined,
  PlusOutlined,
  TableOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import { type SqlLog } from '../../store';
import type { SavedConnection } from '../../types';
import { getCurrentLanguage, t } from '../../i18n';
import { resolveShortcutDisplay } from '../../utils/shortcuts';
import { resolveConnectionHostSummary, resolveConnectionHostTokens } from '../../utils/tabDisplay';
import { resolveConnectionAccentColor, resolveConnectionIconType } from '../../utils/connectionVisual';
import { getDbIcon } from '../DatabaseIcons';
import {
  isV2SidebarObjectNode,
  matchesSidebarSearchText,
  parseV2CommandSearchQuery,
  type V2ExplorerFilter,
} from './sidebarHelpers';
import {
  buildV2CommandSearchTreeIndex,
  dedupeSidebarTreeNodesByKey,
  filterV2CommandSearchTreeItems,
  filterV2ExplorerTreeByKind,
  resolveSidebarNodeConnectionId,
  resolveSidebarTreeVirtualHeight,
  resolveV2ActiveConnectionId,
  type SidebarTreeNode as TreeNode,
  type V2CommandSearchItem,
} from '../sidebarV2Utils';

type SidebarSearchModelArgs = {
  deferredV2CommandSearchValue: string;
  v2CommandSearchValue: string;
  setV2CommandActiveIndex: Dispatch<SetStateAction<number>>;
  v2ExplorerFilter: V2ExplorerFilter;
  treeData: TreeNode[];
  treeHeight: number;
  isV2CommandSearchOpen: boolean;
  connections: SavedConnection[];
  connectionIds: string[];
  selectedKeys: React.Key[];
  selectedNodesRef: MutableRefObject<any[]>;
  activeContext: any;
  activeTab: any;
  recentSqlLogs: SqlLog[];
  shortcutOptions: any;
  activeShortcutPlatform: any;
  overlayTheme: {
    sectionBorder: string;
    mutedText: string;
    titleText: string;
    shellBg: string;
    divider: string;
  };
  darkMode: boolean;
  onCreateConnection?: () => void;
  onToggleLogPanel?: () => void;
  extractObjectName: (fullName: string) => string;
};

export const useSidebarSearchModel = ({
  deferredV2CommandSearchValue,
  v2CommandSearchValue,
  setV2CommandActiveIndex,
  v2ExplorerFilter,
  treeData,
  treeHeight,
  isV2CommandSearchOpen,
  connections,
  connectionIds,
  selectedKeys,
  selectedNodesRef,
  activeContext,
  activeTab,
  recentSqlLogs,
  shortcutOptions,
  activeShortcutPlatform,
  overlayTheme,
  darkMode,
  onCreateConnection,
  onToggleLogPanel,
  extractObjectName,
}: SidebarSearchModelArgs) => {
  const currentLanguage = getCurrentLanguage();
  const connectionById = useMemo(
    () => new Map(connections.map((connection) => [connection.id, connection])),
    [connections],
  );


  // Metadata refreshes can briefly expose the same keyed node more than once.
  // Normalize before filtering so rc-tree's virtual list never receives
  // duplicate keys (which otherwise appear as an endlessly repeated row).
  const normalizedTreeData = useMemo(
    () => dedupeSidebarTreeNodesByKey(treeData),
    [treeData],
  );

  const commandSearchTreeItems = useMemo(() => {
    if (!isV2CommandSearchOpen) {
      return [];
    }
    const result: V2CommandSearchItem[] = [];
    const visit = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        const dataRef = node.dataRef || {};
        if (node.type === 'connection') {
          const conn = dataRef as SavedConnection;
          result.push({
            key: `node-${node.key}`,
            kind: 'node',
            title: String(node.title || conn.name || t('connection.unnamed')),
            meta: resolveConnectionHostSummary(conn.config) || conn.config?.type || t('connection.sidebar.menu.section'),
            icon: getDbIcon(resolveConnectionIconType(conn), resolveConnectionAccentColor(conn), 16),
            node,
          });
        } else if (node.type === 'database' || node.type === 'message-namespace') {
          const conn = connectionById.get(String(dataRef.id || ''));
          result.push({
            key: `node-${node.key}`,
            kind: 'node',
            title: String(node.title || dataRef.dbName || t('database.unnamed')),
            meta: conn?.name || dataRef.id || t('database.label'),
            icon: <DatabaseOutlined />,
            node,
          });
        } else if (isV2SidebarObjectNode(node)) {
          const conn = connectionById.get(String(dataRef.id || ''));
          const objectName = String(
            dataRef.messageObjectName
            || dataRef.topicName
            || dataRef.queueName
            || dataRef.exchangeName
            || dataRef.tableName
            || dataRef.viewName
            || dataRef.sequenceName
            || dataRef.triggerName
            || dataRef.eventName
            || dataRef.routineName
            || dataRef.packageName
            || dataRef.databaseLinkName
            || node.title
            || '',
          ).trim();
          const displayName = String(node.title || extractObjectName(objectName) || objectName).trim();
          const tableComment = String(dataRef.tableComment || '').trim();
          result.push({
            key: `node-${node.key}`,
            kind: 'node',
            title: displayName,
            meta: [
              [conn?.name || dataRef.id, dataRef.dbName].filter(Boolean).join(' · '),
              tableComment,
            ].filter(Boolean).join(' — '),
            icon: node.type === 'table'
              ? <TableOutlined />
              : node.type === 'sequence'
                ? <KeyOutlined />
                : node.type === 'database-link'
                  ? <LinkOutlined />
                  : node.type === 'db-event'
                    ? <ClockCircleOutlined />
                    : ((node.type === 'routine' || node.type === 'package') ? <CodeOutlined /> : <EyeOutlined />),
            node,
          });
        }
        if (node.children) visit(node.children);
      });
    };

    visit(normalizedTreeData);
    return result;
  }, [connectionById, extractObjectName, isV2CommandSearchOpen, normalizedTreeData]);
  const commandSearchTreeIndex = useMemo(
    () => buildV2CommandSearchTreeIndex(commandSearchTreeItems),
    [commandSearchTreeItems],
  );

  const commandSearchRecentItems = useMemo<V2CommandSearchItem[]>(() => {
    return recentSqlLogs.map((log) => ({
      key: `recent-${log.id}`,
      kind: 'recent',
      title: log.sql.replace(/\s+/g, ' ').trim() || t('sidebar.command_search.recent_sql_fallback'),
      meta: `${new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${log.duration}ms${log.dbName ? ` · ${log.dbName}` : ''}`,
      icon: <ClockCircleOutlined />,
      logId: log.id,
      sql: log.sql,
      dbName: log.dbName,
    }));
  }, [recentSqlLogs]);

  const commandSearchActionItems = useMemo<V2CommandSearchItem[]>(() => [
    {
      key: 'action-new-query',
      kind: 'action',
      title: t('query.new'),
      meta: t('sidebar.command_search.action.new_query.meta'),
      shortcut: resolveShortcutDisplay(shortcutOptions, 'newQueryTab', activeShortcutPlatform),
      icon: <PlusOutlined />,
      onRun: () => window.dispatchEvent(new CustomEvent('gonavi:create-query-tab')),
    },
    {
      key: 'action-new-connection',
      kind: 'action',
      title: t('sidebar.command_search.action.new_connection.title'),
      meta: t('sidebar.command_search.action.new_connection.meta'),
      shortcut: resolveShortcutDisplay(shortcutOptions, 'newConnection', activeShortcutPlatform),
      icon: <ThunderboltOutlined />,
      onRun: () => onCreateConnection?.(),
    },
    {
      key: 'action-open-sql-log',
      kind: 'action',
      title: t('sidebar.command_search.action.open_sql_log.title'),
      meta: t('sidebar.command_search.action.open_sql_log.meta'),
      shortcut: resolveShortcutDisplay(shortcutOptions, 'toggleLogPanel', activeShortcutPlatform),
      icon: <BarsOutlined />,
      onRun: () => onToggleLogPanel?.(),
    },
  ], [activeShortcutPlatform, onCreateConnection, onToggleLogPanel, shortcutOptions]);

  const v2CommandSearchQuery = useMemo(
    () => parseV2CommandSearchQuery(deferredV2CommandSearchValue),
    [deferredV2CommandSearchValue],
  );
  const normalizedV2CommandSearchValue = v2CommandSearchQuery.normalizedKeyword;
  const v2CommandSearchObjectMode = v2CommandSearchQuery.mode === 'object';
  const filteredCommandSearchTreeItems = useMemo(() => {
    return filterV2CommandSearchTreeItems(commandSearchTreeIndex, v2CommandSearchQuery);
  }, [commandSearchTreeIndex, v2CommandSearchQuery]);

  const filteredCommandSearchActionItems = useMemo(() => {
    if (v2CommandSearchObjectMode) return [];
    if (!normalizedV2CommandSearchValue) return commandSearchActionItems;
    return commandSearchActionItems.filter((item) => {
      const haystack = `${item.title} ${item.meta}`;
      return matchesSidebarSearchText(haystack, normalizedV2CommandSearchValue);
    });
  }, [commandSearchActionItems, normalizedV2CommandSearchValue, v2CommandSearchObjectMode]);

  const filteredCommandSearchRecentItems = useMemo(() => {
    if (v2CommandSearchObjectMode) return [];
    if (!normalizedV2CommandSearchValue) return commandSearchRecentItems;
    return commandSearchRecentItems.filter((item) => {
      const haystack = `${item.title} ${item.meta}`;
      return matchesSidebarSearchText(haystack, normalizedV2CommandSearchValue);
    });
  }, [commandSearchRecentItems, normalizedV2CommandSearchValue, v2CommandSearchObjectMode]);

  const commandSearchFlatItems = useMemo(
    () => [
      ...filteredCommandSearchTreeItems,
      ...filteredCommandSearchActionItems,
      ...filteredCommandSearchRecentItems,
    ],
    [filteredCommandSearchActionItems, filteredCommandSearchRecentItems, filteredCommandSearchTreeItems],
  );

  useEffect(() => {
    setV2CommandActiveIndex(0);
  }, [setV2CommandActiveIndex, v2CommandSearchValue, commandSearchFlatItems.length]);

  const flattenConnectionNodes = useCallback((nodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    nodes.forEach((node) => {
      if (node.type === 'connection') {
        result.push(node);
      }
      if (node.children) {
        result.push(...flattenConnectionNodes(node.children));
      }
    });
    return result;
  }, []);

  const activeConnectionId = resolveV2ActiveConnectionId({
    activeContextConnectionId: activeContext?.connectionId,
    activeTabConnectionId: activeTab?.connectionId,
    selectedKeys,
    connectionIds,
    fallbackConnectionId: selectedNodesRef.current
      .map((node) => resolveSidebarNodeConnectionId(node, connectionIds))
      .find(Boolean),
  });
  const activeConnection = connections.find((conn) => conn.id === activeConnectionId) || null;
  const activeConnectionDisplayName = String(activeConnection?.name || '').trim() || t('sidebar.active_connection.no_host_selected');
  const activeDatabaseDisplayName = useMemo(() => {
    if (activeContext && typeof activeContext === 'object' && 'dbName' in activeContext) {
      return String(activeContext.dbName || '').trim();
    }
    return String(activeTab?.dbName || '').trim();
  }, [activeContext, activeTab?.dbName]);
  const activeConnectionTreeData = useMemo(() => {
    const externalSQLNodes = normalizedTreeData.filter((node) => node.type === 'external-sql-root');
    if (!activeConnection) return normalizedTreeData;
    const activeConnectionNode = normalizedTreeData.find((node) => node.type === 'connection' && node.key === activeConnection.id);
    if (activeConnectionNode) {
      return dedupeSidebarTreeNodesByKey([
        ...(activeConnectionNode.children && activeConnectionNode.children.length > 0 ? activeConnectionNode.children : []),
        ...externalSQLNodes,
      ]);
    }
    const filterTree = (nodes: TreeNode[]): TreeNode[] => nodes.flatMap((node) => {
      if (node.type === 'tag') {
        return filterTree(node.children || []);
      }
      if (node.type === 'connection') {
        if (node.key !== activeConnection.id) return [];
        return node.children && node.children.length > 0 ? filterTree(node.children) : [];
      }
      return [{ ...node, children: node.children ? filterTree(node.children) : undefined }];
    });

    const filtered = filterTree(normalizedTreeData);
    return dedupeSidebarTreeNodesByKey([...filtered, ...externalSQLNodes]);
  }, [activeConnection, normalizedTreeData]);
  const v2VisibleTreeData = useMemo(() => {
    if (v2ExplorerFilter === 'all') {
      return normalizedTreeData;
    }
    return filterV2ExplorerTreeByKind(activeConnectionTreeData, v2ExplorerFilter);
  }, [activeConnectionTreeData, normalizedTreeData, v2ExplorerFilter]);
  const effectiveTreeHeight = resolveSidebarTreeVirtualHeight(treeHeight);
  const v2TreeMetrics = useMemo(() => {
    const databaseTableCounts = new Map<React.Key, number>();
    const objectGroupCounts = new Map<React.Key, number>();
    let activeObjectCount = 0;

    const visitAndCount = (node: TreeNode): number => {
      const childCount = (node.children || []).reduce((total, child) => total + visitAndCount(child), 0);
      const totalCount = (isV2SidebarObjectNode(node) ? 1 : 0) + childCount;
      if (node.type === 'database') {
        const tableCount = (node.children || []).reduce((total, child) => {
          if (child.type === 'object-group' && child?.dataRef?.groupKey === 'tables') {
            return total + (Array.isArray(child.children) ? child.children.filter((item) => item.type === 'table').length : 0);
          }
          if (child?.dataRef?.groupKey === 'schema' && Array.isArray(child.children)) {
            return total + child.children.reduce((schemaTotal, schemaChild) => {
              if (schemaChild.type === 'object-group' && schemaChild?.dataRef?.groupKey === 'tables') {
                return schemaTotal + (Array.isArray(schemaChild.children) ? schemaChild.children.filter((item) => item.type === 'table').length : 0);
              }
              return schemaTotal;
            }, 0);
          }
          return total;
        }, 0);
        databaseTableCounts.set(node.key, tableCount);
      } else if (node.type === 'message-namespace') {
        databaseTableCounts.set(node.key, childCount);
      } else if (node.type === 'object-group' || node.type === 'message-object-group') {
        objectGroupCounts.set(node.key, childCount);
      }
      return totalCount;
    };

    activeObjectCount = v2VisibleTreeData.reduce((total, node) => total + visitAndCount(node), 0);

    return {
      activeObjectCount,
      databaseTableCounts,
      objectGroupCounts,
    };
  }, [v2VisibleTreeData]);

  return {
    commandSearchTreeItems,
    commandSearchRecentItems,
    commandSearchActionItems,
    v2CommandSearchQuery,
    normalizedV2CommandSearchValue,
    v2CommandSearchObjectMode,
    filteredCommandSearchTreeItems,
    filteredCommandSearchActionItems,
    filteredCommandSearchRecentItems,
    commandSearchFlatItems,
    flattenConnectionNodes,
    activeConnectionId,
    activeConnection,
    activeConnectionDisplayName,
    activeDatabaseDisplayName,
    activeConnectionTreeData,
    v2VisibleTreeData,
    effectiveTreeHeight,
    v2TreeMetrics,
    activeConnectionObjectCount: v2TreeMetrics.activeObjectCount,
  };
};
