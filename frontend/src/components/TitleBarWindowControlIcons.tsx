import React from 'react';

type IconProps = {
  className?: string;
};

const svgProps = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 12 12',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
  focusable: false as const,
};

/** Thin-line Windows caption icons matching the custom titlebar reference art. */
export function TitleBarMinimizeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path
        d="M2.25 6h7.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TitleBarMaximizeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <rect
        x="2.35"
        y="2.35"
        width="7.3"
        height="7.3"
        rx="1.35"
        ry="1.35"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  );
}

export function TitleBarRestoreIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      {/* Rear square (upper-right), drawn as an open path with the segment
          occluded by the front square left out. Nothing has to be painted over
          it, so the glyph stays correct on any hover surface / window opacity. */}
      <path
        d="M3.85 3.85V3.1a1.2 1.2 0 0 1 1.2-1.2h3.7a1.2 1.2 0 0 1 1.2 1.2v3.7a1.2 1.2 0 0 1-1.2 1.2H8"
        stroke="currentColor"
        strokeWidth="1.15"
        fill="none"
      />
      {/* Front square (lower-left) */}
      <rect
        className="titlebar-window-control-restore-front"
        x="1.9"
        y="3.85"
        width="6.1"
        height="6.1"
        rx="1.2"
        ry="1.2"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  );
}

export function TitleBarCloseIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path
        d="M3.1 3.1l5.8 5.8M8.9 3.1l-5.8 5.8"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function resolveTitleBarWindowToggleIcon(kind: 'maximize' | 'restore') {
  return kind === 'restore' ? <TitleBarRestoreIcon /> : <TitleBarMaximizeIcon />;
}

/** 方案 B 品牌区:面板折叠图标(与高保真 titlebar-hifi 一致)。 */
export function TitleBarPanelFoldIcon({ className, style }: IconProps & { style?: React.CSSProperties }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable={false} className={className} style={style}>
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 2.8v10.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11.4 8H8.2M9.6 6.4L8 8l1.6 1.6" stroke="currentColor" strokeWidth="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    </svg>
  );
}

/** 方案 B 品牌区:面板展开图标(侧栏收起态)。 */
export function TitleBarPanelUnfoldIcon({ className, style }: IconProps & { style?: React.CSSProperties }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable={false} className={className} style={style}>
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 2.8v10.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 8h3.2M9.6 6.4L11.2 8l-1.6 1.6" stroke="currentColor" strokeWidth="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    </svg>
  );
}

/** 方案 B:设置齿轮(Feather 风格,与高保真一致)。 */
export function TitleBarGearIcon({ className, style }: IconProps & { style?: React.CSSProperties }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable={false} className={className} style={style}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
