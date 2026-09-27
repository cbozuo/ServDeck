import React from 'react';

/**
 * 标题栏自定义图标。
 *
 * 三枚图标共用一套骨架：24×24 画布、2→22 活动区、1.5 描边、圆角端点与圆角连接。
 * 1.5/24 与 antd 图标（1024 网格 / 62.5 单位）等效，与 PlusOutlined、FolderOutlined
 * 混排时描边重量一致，不会跳重。
 *
 * 「管理分组」沿用 antd 的 FolderOutlined，这里不重复提供。
 */

export interface TitleBarGlyphProps {
  /** 尺寸走 1em，由宿主按钮的 font-size 决定，默认跟随文字字号。 */
  style?: React.CSSProperties;
  className?: string;
}

const BASE_GLYPH_STYLE: React.CSSProperties = {
  width: '1em',
  height: '1em',
  display: 'block',
};

const buildGlyphStyle = (style?: React.CSSProperties): React.CSSProperties => (
  style ? { ...BASE_GLYPH_STYLE, ...style } : BASE_GLYPH_STYLE
);

const SVG_GLYPH_ATTRS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
  'data-titlebar-glyph': 'true',
} as const;

/** 新增服务：服务载体方块 + 右下角加号。加号走对角线，与「新建查询」的居中裸加号区分。 */
export const TitleBarAddServiceIcon: React.FC<TitleBarGlyphProps> = ({ style, className }) => (
  <svg className={className} style={buildGlyphStyle(style)} {...SVG_GLYPH_ATTRS}>
    <rect x="3.5" y="3.5" width="11" height="11" rx="2.6" />
    <path d="M17.7 13.8v7.8M13.8 17.7h7.8" />
  </svg>
);

/** 数据目录：盘片（外环 + 内环）。圆形轮廓是标题栏里唯一没被占用的形状。 */
export const TitleBarDataRootIcon: React.FC<TitleBarGlyphProps> = ({ style, className }) => (
  <svg className={className} style={buildGlyphStyle(style)} {...SVG_GLYPH_ATTRS}>
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);
