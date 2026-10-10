import { describe, expect, it } from 'vitest';

import {
  resolveSidebarContextMenuPosition,
  resolveSidebarTreeRowKey,
} from './sidebarCoreUtils';

describe('sidebarCoreUtils', () => {
  it('keeps context menus inside the viewport', () => {
    expect(resolveSidebarContextMenuPosition(790, 590, {
      viewportWidth: 800,
      viewportHeight: 600,
      width: 240,
      height: 300,
      safeGap: 10,
    })).toEqual({
      x: 550,
      y: 290,
      maxHeight: 300,
    });
  });

  it('resolves the tree node key from the full visual row', () => {
    const row = {
      getAttribute: (name: string) => name === 'data-sidebar-node-key' ? 'service-1' : null,
      querySelector: () => null,
    };
    const target = {
      closest: (selector: string) => selector === '.ant-tree-treenode' ? row : null,
    };

    expect(resolveSidebarTreeRowKey(target as unknown as EventTarget)).toBe('service-1');
    expect(resolveSidebarTreeRowKey({ closest: () => null } as unknown as EventTarget)).toBeNull();
  });
});
