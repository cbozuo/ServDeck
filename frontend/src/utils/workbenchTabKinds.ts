import type { TabData } from '../types';

/** These tabs keep UI/state coupled to the main window (settings center renders
 *  via the App bridge; service detail polls through the local registry store),
 *  so detach to an in-app overlay window instead of a native OS window. */
export const isMainWindowBoundWorkbenchTab = (tab: Pick<TabData, 'type'>): boolean => (
  tab.type === 'settings-center'
  || tab.type === 'service-home'
  || tab.type === 'service-detail'
);
