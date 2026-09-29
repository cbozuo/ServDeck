/** 拖拽自定义光标：Windows 的 grab/grabbing 系统指针（Aero 方案）是白色系，
 *  浅色主题下几乎不可见。这里用内嵌 SVG 自绘手掌，并做两层自适应：
 *  1) 尺寸随视口高度缩放（1080p≈27px，2K≈36px，封顶 44px），跨屏/改分辨率自动重算；
 *  2) 配色跟随主题（浅色=深手掌白描边，深色=浅手掌深描边），切换主题自动换色。
 *  尺寸与配色经 CSS 变量 --gn-drag-cursor-grab / --gn-drag-cursor-grabbing 下发，
 *  使用处统一 cursor: var(--gn-drag-cursor-grab, grab)；fallback 保留系统指针。 */

const GRAB_PATH =
  "<path d='M7.2 11.2 V5.8 C7.2 5 7.8 4.4 8.6 4.4 C9.4 4.4 10 5 10 5.8 V9.5 M10 9.5 V4.9 C10 4.1 10.6 3.5 11.4 3.5 C12.2 3.5 12.8 4.1 12.8 4.9 V9.5 M12.8 9.5 V5.4 C12.8 4.6 13.4 4 14.2 4 C15 4 15.6 4.6 15.6 5.4 V11.6 C15.6 12.4 16.4 12.5 16.7 11.8 L17.4 10.2 C17.7 9.5 18.5 9.3 19 9.7 C19.4 10 19.5 10.5 19.3 11 L18 14.5 C17.2 16.8 15.2 18.3 12.8 18.3 C9.6 18.3 7.2 15.9 7.2 12.7 Z' fill='FILL' stroke='STROKE' stroke-width='1.4' stroke-linejoin='round'/>";

const GRABBING_PATH =
  "<path d='M6.4 11 V8.4 C6.4 7.2 7.3 6.4 8.3 6.4 C8.8 6.4 9.2 6.6 9.5 6.9 C9.8 6 10.6 5.4 11.5 5.4 C12.4 5.4 13.1 6 13.4 6.8 C13.7 6.5 14.1 6.3 14.7 6.3 C15.7 6.3 16.6 7.1 16.6 8.3 V12.4 C16.6 15.7 14.3 17.9 11.3 17.9 C8.3 17.9 6.3 16.1 5.7 13.3 L4.9 11.1 C4.5 10.1 5.1 9.3 6 9.3 C6.4 9.3 6.8 9.5 7.1 9.8 Z' fill='FILL' stroke='STROKE' stroke-width='1.4' stroke-linejoin='round'/><path d='M9.6 9.6 V12.4 M12.6 9.6 V12.4 M15.2 9.8 V12.4' stroke='STROKE' stroke-width='1.1' fill='none' stroke-linecap='round'/>";

interface DragCursorPalette {
  fill: string;
  stroke: string;
}

const DRAG_CURSOR_PALETTES: Record<'light' | 'dark', DragCursorPalette> = {
  light: { fill: '#334155', stroke: '#ffffff' },
  dark: { fill: '#e2e8f0', stroke: '#0f172a' },
};

const resolveDragCursorTheme = (): 'light' | 'dark' => (
  typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light'
);

const buildDragCursorSvg = (
  path: string,
  size: number,
  { fill, stroke }: DragCursorPalette,
): string => (
  `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 22 22'>`
  + path.replace(/FILL/g, fill).replace(/STROKE/g, stroke)
  + '</svg>'
);

const buildDragCursorValue = (
  path: string,
  size: number,
  palette: DragCursorPalette,
  fallback: string,
): string => {
  const hotspot = Math.max(1, Math.round(size / 2));
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(buildDragCursorSvg(path, size, palette))}") ${hotspot} ${hotspot}, ${fallback}`;
};

const resolveDragCursorSize = (): number => (
  Math.max(24, Math.min(44, Math.round(window.innerHeight / 40)))
);

let dragCursorsInstalled = false;

/** 应用启动时调用：注入随视口/主题自适应的拖拽光标 CSS 变量，并监听变化持续更新。 */
export const installDynamicDragCursors = (): void => {
  if (dragCursorsInstalled || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  dragCursorsInstalled = true;

  const apply = () => {
    const size = resolveDragCursorSize();
    const palette = DRAG_CURSOR_PALETTES[resolveDragCursorTheme()];
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty(
      '--gn-drag-cursor-grab',
      buildDragCursorValue(GRAB_PATH, size, palette, 'grab'),
    );
    rootStyle.setProperty(
      '--gn-drag-cursor-grabbing',
      buildDragCursorValue(GRABBING_PATH, size, palette, 'grabbing'),
    );
  };

  apply();

  // 视口变化（改分辨率/跨屏/DPI 缩放）→ 尺寸重算
  let raf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  });

  // 主题切换（body[data-theme] 翻转）→ 配色重算
  const watchTheme = () => {
    if (!document.body) {
      window.requestAnimationFrame(watchTheme);
      return;
    }
    new MutationObserver(apply).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  };
  watchTheme();
};
