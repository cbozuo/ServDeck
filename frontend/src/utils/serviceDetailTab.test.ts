import { describe, expect, it } from 'vitest';

import {
  SERVICE_DETAIL_TAB_ID_PREFIX,
  buildServiceDetailTab,
  buildServiceDetailTabId,
} from './serviceDetailTab';

describe('serviceDetailTab', () => {
  it('builds a per-service tab id with the service-detail prefix', () => {
    expect(buildServiceDetailTabId('my-app')).toBe(`${SERVICE_DETAIL_TAB_ID_PREFIX}my-app`);
    expect(buildServiceDetailTabId('my-app')).not.toBe(buildServiceDetailTabId('other'));
  });

  it('builds a tab carrying the service name as title and metadata', () => {
    const tab = buildServiceDetailTab('my-app');
    expect(tab.id).toBe('service-detail:my-app');
    expect(tab.title).toBe('my-app');
    expect(tab.type).toBe('service-detail');
    expect(tab.serviceName).toBe('my-app');
    expect(tab.connectionId).toBe('');
  });
});
