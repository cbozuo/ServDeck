import { describe, expect, it } from 'vitest';
import { fmtRate, fmtUptime } from './resourceFormat';

const t = (key: string, params?: Record<string, unknown>): string => {
  if (!params) return key;
  let out = key;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(`{{${k}}}`, String(v));
  }
  return out;
};

describe('fmtRate', () => {
  it('零与异常值显示 0 B/s', () => {
    expect(fmtRate(0)).toBe('0 B/s');
    expect(fmtRate(-5)).toBe('0 B/s');
    expect(fmtRate(Number.NaN)).toBe('0 B/s');
  });

  it('按量级换算单位', () => {
    expect(fmtRate(512)).toBe('512 B/s');
    expect(fmtRate(721.4)).toBe('721 B/s');
    expect(fmtRate(1024 * 30.4)).toBe('30.4 KB/s');
    expect(fmtRate(1024 * 1024 * 2.4)).toBe('2.4 MB/s');
    expect(fmtRate(1024 ** 3 * 1.5)).toBe('1.50 GB/s');
  });
});

describe('fmtUptime', () => {
  it('不足一小时只显示分钟', () => {
    expect(fmtUptime(59 * 60, t)).toBe('home.res.uptime.m');
    expect(fmtUptime(14 * 60 + 32, t)).toBe('home.res.uptime.m');
  });

  it('跨小时与跨天按时级格式拼接', () => {
    // 7时14分
    expect(fmtUptime(7 * 3600 + 14 * 60, t)).toBe('home.res.uptime.h home.res.uptime.m');
    // 1天 1时 1分
    expect(fmtUptime(86400 + 3600 + 60, t)).toBe(
      'home.res.uptime.d home.res.uptime.h home.res.uptime.m',
    );
  });

  it('负值按 0 处理', () => {
    expect(fmtUptime(-10, t)).toBe('home.res.uptime.m');
  });
});
