import { readFileSync } from 'node:fs';

export const readV2ThemeCss = (): string => [
  readFileSync(new URL('../v2-theme.css', import.meta.url), 'utf8'),
  readFileSync(new URL('../styles/v2-theme-workbench.css', import.meta.url), 'utf8'),
]
  .join('\n')
  // Windows 检出为 CRLF 时,源码级断言(按 "\n" 连写选择器定位规则块)仍可匹配
  .replace(/\r\n/g, '\n');
