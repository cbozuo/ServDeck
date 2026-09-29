/**
 * 详情页资源趋势的采样缓冲与 SVG 分带绘制工具（对齐 service-detail-page-v2 的趋势面板）。
 * 前端每 2 秒推入一个采样点，缓冲 90 点（30 分钟）；三个指标在各自带内归一化绘制。
 */

export const DETAIL_TREND_POINTS = 90;

export interface DetailTrendPoint {
  /** epoch 毫秒 */
  at: number;
  cpuPct: number;
  memMB: number;
  threads: number;
}

/** 环形缓冲推入（超出上限丢最旧）。 */
export function pushTrendPoint(buffer: DetailTrendPoint[], point: DetailTrendPoint): DetailTrendPoint[] {
  const next = [...buffer, point];
  return next.length > DETAIL_TREND_POINTS ? next.slice(next.length - DETAIL_TREND_POINTS) : next;
}

export interface TrendBand {
  /** 归一化带内 y 起点（0-1 视口比例）与高度 */
  top: number;
  height: number;
  points: Array<{ x: number; y: number }>;
}

interface BandSpec {
  key: keyof Pick<DetailTrendPoint, 'cpuPct' | 'memMB' | 'threads'>;
  top: number;
  height: number;
  /** 带内归一化的最大值；<=0 时按数据最大值自适应 */
  fixedMax?: number;
}

// 设计稿带宽：CPU 0.04–0.30、内存 0.37–0.63、线程 0.70–0.96
const BANDS: BandSpec[] = [
  { key: 'cpuPct', top: 0.04, height: 0.26, fixedMax: 100 },
  { key: 'memMB', top: 0.37, height: 0.26 },
  { key: 'threads', top: 0.70, height: 0.26 },
];

/**
 * 把缓冲数据映射为三条带内折线（viewBox 归一化 0-1 坐标）。
 * 单点/空缓冲返回空数组；数值变化不足时压在带底。
 */
export function buildTrendBands(buffer: DetailTrendPoint[]): TrendBand[] {
  if (buffer.length < 2) {
    return [];
  }
  const first = buffer[0].at;
  const span = Math.max(1, buffer[buffer.length - 1].at - first);
  return BANDS.map(({ key, top, height, fixedMax }) => {
    const values = buffer.map((p) => p[key]);
    const max = fixedMax && fixedMax > 0 ? fixedMax : Math.max(...values, 1);
    return {
      top,
      height,
      points: buffer.map((p, index) => ({
        x: (p.at - first) / span,
        y: top + height - Math.min(1, p[key] / max) * height,
      })),
    };
  });
}
