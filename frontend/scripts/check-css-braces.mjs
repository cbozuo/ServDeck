#!/usr/bin/env node
// 构建前的 CSS 花括号配平检查。
//
// 背景：2026-09 AddServiceModal.css 里一段孤儿声明（规则提前闭合 + 多余 }）在
// production 合并 bundle 中让 CSS 解析器吞掉紧随其后的 .svc-home 规则，首页布局
// 整体失效；dev 模式每个 CSS 文件独立注入，错误不跨文件，因此本地走查无法发现。
// 这条检查在 vite build 之前对源文件做配平校验，语法错误直接让构建失败。
//
// 用法：node scripts/check-css-braces.mjs [scanDir]
//   scanDir 默认为 ../src；发现配平错误时 exit 1。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(process.argv[2] ?? join(scriptDir, '..', 'src'));

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.css')) files.push(full);
  }
};
walk(rootDir);

const failures = [];
for (const file of files) {
  const css = readFileSync(file, 'utf8');
  const { depth, issues } = scanBraces(css);
  for (const issue of issues) {
    failures.push(`${relative(rootDir, file)}:${issue.line} ${issue.issue}`);
  }
  if (depth !== 0 && issues.length === 0) {
    failures.push(`${relative(rootDir, file)} 花括号未闭合（缺少 ${depth} 个 }）`);
  }
}

if (failures.length > 0) {
  console.error(`\n[check-css-braces] 发现 ${failures.length} 处括号配平错误：`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error('CSS 语法错误会在 production 合并 bundle 时吞掉其他文件的规则，请先修复再构建。\n');
  process.exit(1);
}

console.log(`[check-css-braces] ${files.length} 个 CSS 文件括号配平正常。`);

/** 字符级扫描花括号配平；注释与字符串里的花括号不计入。 */
function scanBraces(css) {
  const issues = [];
  let depth = 0;
  let line = 1;
  let state = 'code'; // code | comment | single-quote | double-quote
  let index = 0;
  while (index < css.length) {
    const ch = css[index];
    const next = css[index + 1];
    if (ch === '\n') line += 1;
    if (state === 'code') {
      if (ch === '/' && next === '*') {
        state = 'comment';
        index += 2;
        continue;
      }
      if (ch === '\'' || ch === '"') {
        state = ch === '\'' ? 'single-quote' : 'double-quote';
        index += 1;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth < 0) {
          issues.push({ line, issue: '多余的 }' });
          depth = 0;
        }
      }
    } else if (state === 'comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        index += 2;
        continue;
      }
    } else if (ch === '\\') {
      index += 2;
      continue;
    } else if ((state === 'single-quote' && ch === '\'') || (state === 'double-quote' && ch === '"')) {
      state = 'code';
    }
    index += 1;
  }
  return { depth, issues };
}
