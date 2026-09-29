import type { TabData } from '../types';

export const SERVICE_DETAIL_TAB_ID_PREFIX = 'service-detail:';

/** 每个纳管服务一个详情 tab；同 id 重复打开由 addTab 聚焦。 */
export const buildServiceDetailTabId = (name: string): string =>
  `${SERVICE_DETAIL_TAB_ID_PREFIX}${name}`;

export const buildServiceDetailTab = (name: string): TabData => ({
  id: buildServiceDetailTabId(name),
  title: name,
  type: 'service-detail',
  connectionId: '',
  serviceName: name,
});
