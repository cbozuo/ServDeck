import type { I18nParams } from '../../i18n/types';

type TFn = (key: string, params?: I18nParams) => string;

/** 速率显示：B/s → KB/s → MB/s → GB/s。 */
export function fmtRate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) {
    return '0 B/s';
  }
  if (bps < 1024) {
    return `${Math.round(bps)} B/s`;
  }
  if (bps < 1024 ** 2) {
    return `${(bps / 1024).toFixed(1)} KB/s`;
  }
  if (bps < 1024 ** 3) {
    return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  }
  return `${(bps / 1024 ** 3).toFixed(2)} GB/s`;
}

/** 开机时长：按需省略高位段（7时14分 / 1天 3时5分），分钟段始终保留。 */
export function fmtUptime(seconds: number, t: TFn): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) {
    parts.push(t('home.res.uptime.d', { n: days }));
  }
  if (days > 0 || hours > 0) {
    parts.push(t('home.res.uptime.h', { n: hours }));
  }
  parts.push(t('home.res.uptime.m', { n: minutes }));
  return parts.join(' ');
}
