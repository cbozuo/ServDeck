/**
 * 最大堆内存滑杆的纯函数集（对齐服务详情页高保真交互）。
 *
 * 上限口径：本机物理内存 × 75%，向下取整到 0.5G——超出机器内存的 -Xmx
 * 会让 JVM 起不来；档位吸附（非连续取值）避免拖出 -Xms1023m 这类难排查的参数。
 * 写入 servy --params 时 -Xms/-Xmx 同值，整数 GB 用 g，其余折算到 MB
 * （JVM 不接受「小数+单位」的堆写法）。
 */

/** 检测不到物理内存时的兜底上限（G），与高保真演示的 32G 物理内存机器一致。 */
export const HEAP_FALLBACK_TOTAL_GB = 32;
/** 堆上限占物理内存的比例。 */
export const HEAP_CAP_RATIO = 0.75;
/** 档位候选：过滤掉超过上限的档位后即为滑杆停靠点。 */
export const HEAP_BASE_STOPS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

/** 物理内存（字节）→ 堆上限（G）：×75% 向下取整到 0.5G，至少 1G。 */
export function heapCapFromTotalBytes(totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    return heapCapFromTotalBytes(HEAP_FALLBACK_TOTAL_GB * 1024 ** 3);
  }
  const capGB = Math.floor((totalBytes / 1024 ** 3) * HEAP_CAP_RATIO * 2) / 2;
  return Math.max(1, capGB);
}

/** 堆上限（G）→ 滑杆档位；未检测到时按兜底物理内存计算。 */
export function heapStopsForCap(capGB?: number | null): number[] {
  const cap = capGB && capGB > 0 ? capGB : heapCapFromTotalBytes(HEAP_FALLBACK_TOTAL_GB * 1024 ** 3);
  return HEAP_BASE_STOPS.filter((stop) => stop <= cap);
}

/** 档位显示：0.5 → 512M，整数 → 2G。 */
export function heapLabel(gb: number): string {
  return gb < 1 ? `${Math.round(gb * 1024)}M` : `${gb}G`;
}

/**
 * 手输值 → G（浮点）；支持 数字 + 可选单位（m / g，大小写不限），
 * 裸数字按 G。非法（空、负数、0、非数字）返回 null。
 */
export function parseHeapInput(raw: string): number | null {
  const match = String(raw ?? '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*([mMgG]?)$/);
  if (!match) {
    return null;
  }
  const gb = parseFloat(match[1]) * (match[2].toLowerCase() === 'm' ? 1 / 1024 : 1);
  return gb > 0 ? gb : null;
}

/** jvmArgs 串里的 -Xmx → G（浮点）；没有 -Xmx 或非法返回 null。 */
export function heapGBFromArgs(args: string): number | null {
  const match = String(args ?? '').match(/-Xmx(\d+)([mMgG])/);
  if (!match) {
    return null;
  }
  const gb = parseInt(match[1], 10) * (match[2].toLowerCase() === 'm' ? 1 / 1024 : 1);
  return gb > 0 ? gb : null;
}

/** G → JVM 规范写法：整数 GB 用 g，其余四舍五入到 MB。 */
export function canonicalHeap(gb: number): string {
  const mb = Math.round(gb * 1024);
  return mb % 1024 === 0 ? `${mb / 1024}g` : `${mb}m`;
}

/** 滑杆停靠点里最近档位的下标（同距取较低档）。 */
export function nearestStopIndex(stops: number[], gb: number): number {
  if (stops.length === 0) {
    return 0;
  }
  return stops.reduce(
    (best, stop, index) => (Math.abs(stop - gb) < Math.abs(stops[best] - gb) ? index : best),
    0,
  );
}

/**
 * 输入框当前应显示的值：正好落在档位上用档位文案（2G），
 * 自定义值用 JVM 规范写法（1536m）。
 */
export function heapDisplayValue(gb: number, stops: number[]): string {
  return stops.includes(gb) ? heapLabel(gb) : canonicalHeap(gb);
}
