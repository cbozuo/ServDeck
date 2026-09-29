import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpenOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { useI18n } from '../../i18n/provider';
import { OpenServiceLogDirectory } from '../../../wailsjs/go/app/App';
import { useServiceLogContent, useServiceLogFiles } from './useServiceDetail';

const formatSize = (bytes: number): string =>
  bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatMtime = (epoch: number): string => {
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * 行级时间：servy 引擎写盘不支持逐行时间戳，每行的真实输出时刻 ServDeck 拿不到。
 * 只标注「可确证」的时间——本次会话轮询检测到的新增行 = 检测时刻（误差 ≤ 轮询间隔）；
 * 打开页面就存在的历史行不标时间（标文件修改时刻会误导排查，用户明确反对假时间）。
 * 返回数组里 0 = 无可确证时间，渲染时留空。
 */
const useLineTimes = (lines: string[]): number[] => {
  const historyRef = useRef<{ lines: string[]; times: number[] }>({ lines: [], times: [] });
  return useMemo(() => {
    const prev = historyRef.current;
    let shared = 0;
    const max = Math.min(prev.lines.length, lines.length);
    while (shared < max && prev.lines[shared] === lines[shared]) {
      shared += 1;
    }
    // 首次加载（无历史）：全部无时间；增量刷新：共享前缀保留原判，新增行 = 检测时刻
    const isFirstLoad = prev.lines.length === 0;
    const now = Date.now();
    const times = lines.map((_, index) => {
      if (index < shared) return prev.times[index];
      return isFirstLoad ? 0 : now;
    });
    historyRef.current = { lines, times };
    return times;
  }, [lines]);
};

/** 日志页签：文件 chips + 工具条 + 终端式视图（级别着色，行带时间，自动滚动到底部）。 */
export const DetailLogsPane: React.FC<{ name: string; logDir: string; enabled: boolean }> = ({ name, logDir, enabled }) => {
  const { t } = useI18n();
  const files = useServiceLogFiles(name, enabled);
  const [selected, setSelected] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const activeFile = selected ?? files[0]?.name ?? null;
  const content = useServiceLogContent(name, activeFile, enabled);
  const viewRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(
    () => content.split('\n').filter((line, index, all) => line.trim() !== '' || index < all.length - 1),
    [content],
  );
  const lineTimes = useLineTimes(lines);

  // 自动滚动：内容刷新（3 秒轮询）后贴底；用户关掉开关或向上滚动空间由开关控制
  useEffect(() => {
    if (!autoScroll) return;
    const el = viewRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [content, autoScroll]);

  const levelClass = (line: string): string => {
    if (/\b(ERROR|ERR|FATAL)\b/i.test(line)) return 'err';
    if (/\b(WARN|WARNI)\b/i.test(line)) return 'warn';
    return 'info';
  };

  return (
    <div className="dtl-pane">
      <div className="dtl-log-files">
        {files.length === 0 ? (
          <span className="dtl-log-none">{t('detail.logs.noFiles')}</span>
        ) : (
          files.map((file) => (
            <button
              key={file.name}
              type="button"
              className={`dtl-log-file${activeFile === file.name ? ' on' : ''}`}
              onClick={() => setSelected(file.name)}
            >
              <span className="mono">
                {file.kind === 'err' && <i className="dtl-err-dot" />}
                {file.name}
              </span>
              <small>{formatSize(file.sizeBytes)} · {formatMtime(file.modifiedAt)}</small>
            </button>
          ))
        )}
      </div>
      <div className="dtl-log-toolbar">
        <span className="mono">{activeFile ?? '—'}</span>
        <button
          type="button"
          className={`dtl-chip-btn${autoScroll ? ' on' : ''}`}
          onClick={() => setAutoScroll((v) => !v)}
        >
          <VerticalAlignBottomOutlined />
          {t('detail.logs.autoScroll')}
        </button>
        <button
          type="button"
          className="dtl-chip-btn"
          title={logDir}
          onClick={() => {
            void (async () => {
              const result = await OpenServiceLogDirectory(name);
              if (!result.success) {
                message.error(result.message || t('detail.logs.openDir'));
              }
            })();
          }}
        >
          <FolderOpenOutlined />
          {t('detail.logs.openDir')}
        </button>
      </div>
      <div ref={viewRef} className="dtl-log-view mono" data-autoscroll={autoScroll}>
        {lines.length === 0 ? (
          <div className="dtl-log-empty">{t('detail.logs.empty')}</div>
        ) : (
          lines.map((line, index) => {
            const at = lineTimes[index] ?? 0;
            return (
              <div key={index} className={`dtl-log-line lv-${levelClass(line)}`}>
                {/* 0 = 无可确证的输出时刻（打开页面就存在的历史行），留空不造假 */}
                {at > 0 && <span className="dtl-log-line-time mono">{formatMtime(at / 1000)}</span>}
                {line}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
