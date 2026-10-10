const SIDEBAR_CONTEXT_MENU_SAFE_GAP = 8;
export const SIDEBAR_CONTEXT_MENU_FALLBACK_WIDTH = 264;
export const SIDEBAR_CONTEXT_MENU_FALLBACK_HEIGHT = 420;

export const resolveSidebarContextMenuPosition = (
  x: number,
  y: number,
  options?: {
    width?: number;
    height?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    safeGap?: number;
  },
): { x: number; y: number; maxHeight: number } => {
  const safeGap = options?.safeGap ?? SIDEBAR_CONTEXT_MENU_SAFE_GAP;
  const viewportWidth = options?.viewportWidth ?? (typeof window === 'undefined' ? 1024 : window.innerWidth);
  const viewportHeight = options?.viewportHeight ?? (typeof window === 'undefined' ? 768 : window.innerHeight);
  const width = Math.max(0, options?.width ?? SIDEBAR_CONTEXT_MENU_FALLBACK_WIDTH);
  const height = Math.max(0, options?.height ?? SIDEBAR_CONTEXT_MENU_FALLBACK_HEIGHT);
  const maxX = Math.max(safeGap, viewportWidth - width - safeGap);
  const maxY = Math.max(safeGap, viewportHeight - height - safeGap);
  const nextX = Math.max(safeGap, Math.min(x, maxX));
  const nextY = Math.max(safeGap, Math.min(y, maxY));
  return {
    x: nextX,
    y: nextY,
    maxHeight: Math.max(120, viewportHeight - nextY - safeGap),
  };
};

export const resolveSidebarTreeRowKey = (target: EventTarget | null | undefined): string | null => {
  if (!target || typeof (target as Element).closest !== 'function') return null;
  const row = (target as Element).closest('.ant-tree-treenode');
  const key = row?.getAttribute('data-sidebar-node-key')
    || row?.querySelector('[data-sidebar-node-key]')?.getAttribute('data-sidebar-node-key');
  return String(key || '').trim() || null;
};
