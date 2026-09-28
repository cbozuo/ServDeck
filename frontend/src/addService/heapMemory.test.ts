import { describe, expect, it } from 'vitest';

import {
  canonicalHeap,
  heapCapFromTotalBytes,
  heapDisplayValue,
  heapLabel,
  heapStopsForCap,
  nearestStopIndex,
  parseHeapInput,
} from './heapMemory';
import { SERVICE_TEMPLATES } from './serviceTemplates';

describe('heapCapFromTotalBytes', () => {
  it('caps at 75% of physical memory, rounded down to 0.5G', () => {
    const gb = 1024 ** 3;
    expect(heapCapFromTotalBytes(32 * gb)).toBe(24);
    expect(heapCapFromTotalBytes(16 * gb)).toBe(12);
    expect(heapCapFromTotalBytes(8 * gb)).toBe(6);
    // 7G 物理 × 0.75 = 5.25 → 向下取整到 0.5G
    expect(heapCapFromTotalBytes(7 * gb)).toBe(5);
  });

  it('keeps at least 1G and falls back on bad input', () => {
    expect(heapCapFromTotalBytes(1 * 1024 ** 3)).toBe(1);
    expect(heapCapFromTotalBytes(0)).toBeGreaterThan(0);
    expect(heapCapFromTotalBytes(Number.NaN)).toBeGreaterThan(0);
  });
});

describe('heapStopsForCap', () => {
  it('filters stops above the cap', () => {
    expect(heapStopsForCap(24)).toEqual([0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24]);
    expect(heapStopsForCap(4)).toEqual([0.5, 1, 2, 3, 4]);
    expect(heapStopsForCap(64)).toEqual([0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]);
  });

  it('always keeps the lowest stop', () => {
    const stops = heapStopsForCap(0.5);
    expect(stops[0]).toBe(0.5);
    expect(stops.length).toBeGreaterThan(0);
  });
});

describe('heap label / canonical / parse', () => {
  it('labels sub-1G stops in MB', () => {
    expect(heapLabel(0.5)).toBe('512M');
    expect(heapLabel(2)).toBe('2G');
  });

  it('canonicalizes to whole GB or MB (JVM rejects fractional units)', () => {
    expect(canonicalHeap(2)).toBe('2g');
    expect(canonicalHeap(1.5)).toBe('1536m');
    expect(canonicalHeap(0.75)).toBe('768m');
  });

  it('parses number + optional unit; bare numbers are GB', () => {
    expect(parseHeapInput('2G')).toBe(2);
    expect(parseHeapInput('2g')).toBe(2);
    expect(parseHeapInput('1536M')).toBe(1.5);
    expect(parseHeapInput('1536m')).toBe(1.5);
    expect(parseHeapInput('4')).toBe(4);
    expect(parseHeapInput('1.5G')).toBe(1.5);
    expect(parseHeapInput(' 2G ')).toBe(2);
  });

  it('rejects empty, negative-ish and non-numeric input', () => {
    expect(parseHeapInput('')).toBeNull();
    expect(parseHeapInput('abc')).toBeNull();
    expect(parseHeapInput('0')).toBeNull();
    expect(parseHeapInput('-2G')).toBeNull();
    expect(parseHeapInput('2x')).toBeNull();
  });
});

describe('nearestStopIndex / heapDisplayValue', () => {
  const stops = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24];

  it('snaps to the closest stop, ties go lower', () => {
    expect(nearestStopIndex(stops, 2)).toBe(2);
    expect(nearestStopIndex(stops, 1.5)).toBe(1);
    expect(nearestStopIndex(stops, 1.6)).toBe(2);
    expect(nearestStopIndex(stops, 100)).toBe(stops.length - 1);
    expect(nearestStopIndex(stops, 0.1)).toBe(0);
  });

  it('uses stop label on stops and canonical form for custom values', () => {
    expect(heapDisplayValue(2, stops)).toBe('2G');
    expect(heapDisplayValue(1.5, stops)).toBe('1536m');
  });
});

describe('java template jvmArgs wiring', () => {
  it('keeps -Xms/-Xmx first and preserves the rest of jvmArgs', () => {
    const params = SERVICE_TEMPLATES.java.params(
      {
        jvmPath: 'C:\\jdk\\java.exe',
        jvmArgs: '-Xms2g -Xmx2g -XX:+UseG1GC',
      },
      'D:\\apps\\order\\order.jar',
    );
    expect(params).toBe('-Xms2g -Xmx2g -XX:+UseG1GC -jar "D:\\apps\\order\\order.jar"');
  });

  it('falls back to just -jar when jvmArgs is cleared', () => {
    const params = SERVICE_TEMPLATES.java.params({ jvmArgs: '' }, 'D:\\apps\\order\\order.jar');
    expect(params).toBe('-jar "D:\\apps\\order\\order.jar"');
  });
});
