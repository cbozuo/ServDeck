import type { TabData } from '../types';

export const isBackgroundTaskWorkbenchTab = (tab: Pick<TabData, 'type'>): boolean => (
  tab.type === 'table-export' || tab.type === 'data-import' || tab.type === 'data-sync'
);

/** These tabs keep UI/state coupled to the main window (settings center renders
 *  via the App bridge; service detail polls through the local registry store),
 *  so detach to an in-app overlay window instead of a native OS window. */
export const isMainWindowBoundWorkbenchTab = (tab: Pick<TabData, 'type'>): boolean => (
  tab.type === 'settings-center'
  || tab.type === 'service-detail'
  || isBackgroundTaskWorkbenchTab(tab)
);
