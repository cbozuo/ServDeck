import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  DB_ICON_TYPES,
  getDbIcon,
  getDbIconAssetSrc,
  getDbIconLabel,
  hasDbIconAsset,
} from './DatabaseIcons';
const translate = (key: string) =>
  key === 'connection_modal.db_icon_label.custom' ? 'T:custom' : key;

// 数据库品牌图标资产已在 f658073 清理（35 个删除，资产目录仅存 java/mysql/redis/rustfs）；
// 此处只保留现存资产的用例。数据库品牌 SVG 组件大清单随数据库专项一并退役。
const BRAND_ICON_CASES: Array<[string, string, string]> = [
  ['mysql', 'MySQL', 'mysql.svg'],
  ['redis', 'Redis', 'redis.svg'],
  ['jvm', 'JVM', 'java.svg'],
];

describe('DatabaseIcons', () => {
  for (const [type, label, asset] of BRAND_ICON_CASES) {
    it(`includes ${label} in the selectable database icons`, () => {
      expect(DB_ICON_TYPES).toContain(type);
      expect(getDbIconLabel(type)).toBe(label);
      expect(hasDbIconAsset(type)).toBe(true);
      expect(getDbIconAssetSrc(type)).toContain(asset);
      const markup = renderToStaticMarkup(<>{getDbIcon(type, undefined, 22)}</>);
      expect(markup).toContain(`src="${getDbIconAssetSrc(type)}"`);
      expect(markup).toContain(`alt="${type}"`);
    });
  }

  it('wraps database icons in a consistent frame for sidebar sizing', () => {
    const mysqlMarkup = renderToStaticMarkup(<>{getDbIcon('mysql', undefined, 22)}</>);
    const jvmMarkup = renderToStaticMarkup(<>{getDbIcon('jvm', undefined, 22)}</>);

    expect(mysqlMarkup).toContain('data-db-icon-frame="true"');
    expect(jvmMarkup).toContain('data-db-icon-frame="true"');
    expect(mysqlMarkup).toContain('width:22px');
    expect(jvmMarkup).toContain('width:22px');
  });

  it('localizes the custom icon label without translating database brand names', () => {
    expect(getDbIconLabel('custom', translate)).toBe('T:custom');
    expect(getDbIconLabel('mysql', translate)).toBe('MySQL');
    expect(getDbIconLabel('kingbase', translate)).toBe('Kingbase');
    expect(getDbIconLabel('dameng', translate)).toBe('Dameng');
    expect(getDbIconLabel('highgo', translate)).toBe('HighGo');
  });
});
