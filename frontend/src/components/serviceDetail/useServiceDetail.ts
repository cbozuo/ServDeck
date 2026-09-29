import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckServicePorts,
  GetServiceDirUsage,
  GetWindowsServiceDetail,
  ListServiceEngineEvents,
  ListServiceLogFiles,
  ReadServiceLogTail,
  SampleServiceDetailMetrics,
} from '../../../wailsjs/go/app/App';
import type { ServiceDeploySnapshot } from '../../serviceRegistryStore';
import { normalizeProcessState, type DetailPending, type DetailRuleInput } from './detailRules';

const POLL_MS = 2000;

/** GetWindowsServiceDetail 的返回（service_detail_windows.go: serviceDetailSnapshot）。 */
export interface ServiceDetailInfo {
  name: string;
  /** SCM 中是否存在此服务；false = 已被卸载/未注册 */
  installed: boolean;
  displayName: string;
  description: string;
  state: string;
  pid: number;
  startType: string;
  delayedAutoStart: boolean;
  binaryPathName: string;
  account: string;
  dependencies: string[];
  startedAt: number;
  uptimeSeconds: number;
  programFile: string;
  logDir: string;
}

/** SampleServiceDetailMetrics 的返回（serviceDetailSample）。 */
export interface ServiceDetailSample {
  state: string;
  pid: number;
  /** 进程启动以来累计 CPU 秒；CPU% 由前端两次采样差值计算 */
  cpuTotal: number;
  /** 两次采样差值算出的百分比；首轮为 null */
  cpuPct?: number | null;
  memBytes: number;
  threads: number;
  handles: number;
  diskReadBps: number;
  diskWriteBps: number;
  netConns: number;
}

export interface ServiceLogFile {
  name: string;
  sizeBytes: number;
  modifiedAt: number;
  kind: string;
}

export interface ServicePortCheck {
  port: number;
  listening: boolean;
}

/** 详情页一轮完整数据（详情快照 + 指标 + 端口 + 目录占用）。 */
export interface ServiceDetailData {
  info: ServiceDetailInfo | null;
  sample: ServiceDetailSample | null;
  ports: ServicePortCheck[];
  portTotal: number;
  portOkCount: number;
  dirBytes: number;
}

/** useServiceDetail：详情页的数据轮询中枢（详情快照挂载取一次，指标/端口 2 秒轮询）。 */
export function useServiceDetail(name: string, deploy: ServiceDeploySnapshot | undefined, enabled: boolean) {
  const [info, setInfo] = useState<ServiceDetailInfo | null>(null);
  const [sample, setSample] = useState<ServiceDetailSample | null>(null);
  const [ports, setPorts] = useState<ServicePortCheck[]>([]);
  const [dirBytes, setDirBytes] = useState(0);
  const [pending, setPending] = useState<DetailPending>(null);
  const [deployDraft, setDeployDraft] = useState<ServiceDeploySnapshot | null>(deploy ?? null);
  const [deployDirty, setDeployDirty] = useState(false);
  const lastCpuSampleRef = useRef<{ pid: number; cpuTotal: number; at: number } | null>(null);

  const refreshInfo = useCallback(async () => {
    try {
      const result = await GetWindowsServiceDetail(name);
      if (result.success) {
        const next = (result.data ?? null) as ServiceDetailInfo | null;
        setInfo(next);
        // 服务未注册（被卸载/注册失败清理）时清空残留指标，避免旧采样误导
        if (next && next.installed === false) {
          setSample(null);
        }
      }
    } catch {
      // 非 Windows 构建保留现状
    }
  }, [name]);

  const refreshMetrics = useCallback(async () => {
    try {
      const result = await SampleServiceDetailMetrics(name);
      const next = (result.data as { sample?: ServiceDetailSample | null } | null)?.sample ?? null;
      if (next && next.pid) {
        const prev = lastCpuSampleRef.current;
        if (prev && prev.pid === next.pid && next.cpuTotal >= prev.cpuTotal) {
          const elapsed = (Date.now() - prev.at) / 1000;
          next.cpuPct = elapsed > 0 ? Math.max(0, ((next.cpuTotal - prev.cpuTotal) / elapsed) * 100) : 0;
        } else {
          next.cpuPct = null;
        }
        lastCpuSampleRef.current = { pid: next.pid, cpuTotal: next.cpuTotal, at: Date.now() };
      }
      setSample(next);
    } catch {
      // 采样失败保留上次值
    }
  }, [name]);

  const refreshPorts = useCallback(async () => {
    const configured = parseConfiguredPorts([
      deployDraft?.jvmArgs ?? '',
      deployDraft?.params ?? '',
    ]);
    if (configured.length === 0) {
      setPorts([]);
      return;
    }
    try {
      const result = await CheckServicePorts(configured);
      const data = (result.data ?? {}) as { ports?: ServicePortCheck[]; total?: number; okCount?: number };
      setPorts(data.ports ?? []);
    } catch {
      setPorts([]);
    }
  }, [deployDraft?.jvmArgs, deployDraft?.params]);

  const refreshDir = useCallback(async () => {
    try {
      const programFile = info?.programFile || deployDraft?.programFile || '';
      const result = await GetServiceDirUsage(name, programFile);
      const data = (result.data ?? {}) as { bytes?: number };
      setDirBytes(data.bytes ?? 0);
    } catch {
      setDirBytes(0);
    }
  }, [deployDraft?.programFile, info?.programFile, name]);

  useEffect(() => {
    if (!enabled || !name) {
      return;
    }
    void refreshInfo();
    void refreshMetrics();
    void refreshPorts();
    void refreshDir();
    const timer = window.setInterval(() => {
      if (!pending) {
        void refreshMetrics();
        void refreshPorts();
      }
    }, POLL_MS);
    const dirTimer = window.setInterval(() => void refreshDir(), 5 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(dirTimer);
    };
    // pending 变化只影响轮询是否跳过，无需重挂
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, name, refreshInfo, refreshMetrics, refreshPorts, refreshDir]);

  /** 操作后的即时刷新（控制/注册/卸载完成时调用）。 */
  const refreshAfterAction = useCallback(async () => {
    await Promise.all([refreshInfo(), refreshMetrics(), refreshPorts()]);
  }, [refreshInfo, refreshMetrics, refreshPorts]);

  // deployDraft 跟随纳管记录的 deploy 快照：卸载（deploy → undefined）清空草稿，
  // 重新注册写入新快照（undefined → 有值）时重置为最新，避免继续编辑已失效的旧草稿。
  const lastDeployPropRef = useRef(deploy);
  useEffect(() => {
    const prev = lastDeployPropRef.current;
    if (prev !== undefined && deploy === undefined) {
      setDeployDraft(null);
      setDeployDirty(false);
    } else if (prev === undefined && deploy !== undefined) {
      setDeployDraft(deploy);
      setDeployDirty(false);
    }
    lastDeployPropRef.current = deploy;
  }, [deploy]);

  const ruleInput = useMemo(() => {
    const processState = normalizeProcessState(info?.state ?? 'Unknown', pending);
    const mode: 'managed' | 'adopted' = deployDraft ? 'managed' : 'adopted';
    const input: DetailRuleInput = {
      processState,
      mode,
      pending,
      installed: info ? info.installed !== false : undefined,
      startTypeDisabled: (info?.startType ?? '') === 'Disabled',
      deployMissing: !deployDraft,
    };
    return { input, processState, mode };
  }, [deployDraft, info, pending]);

  return {
    info,
    sample,
    ports,
    dirBytes,
    pending,
    setPending,
    deployDraft,
    setDeployDraft,
    deployDirty,
    setDeployDirty,
    refreshInfo,
    refreshMetrics,
    refreshAfterAction,
    ruleInput,
  };
}

/** 从参数串解析常见端口配置（与后端 extractConfiguredPorts 同口径的前端子集）。 */
export function parseConfiguredPorts(sources: string[]): number[] {
  const ports: number[] = [];
  const seen = new Set<number>();
  const prefixes = ['-Dserver.port=', '--server.port=', '-Dport=', '--port='];
  for (const source of sources) {
    for (const token of source.split(/\s+/)) {
      for (const prefix of prefixes) {
        if (token.startsWith(prefix)) {
          const port = parseInt(token.slice(prefix.length), 10);
          if (Number.isFinite(port) && port > 0 && port <= 65535 && !seen.has(port)) {
            seen.add(port);
            ports.push(port);
          }
        }
      }
    }
  }
  return ports;
}

/** servy 引擎日志里该服务的一条事件（at 为引擎写盘的真实时刻，epoch 秒）。 */
export interface ServiceEngineEvent {
  at: number;
  level: string;
  text: string;
}

/** 引擎事件 hook：读 servy 引擎日志按服务过滤（挂载取一次 + 10 秒轮询）。 */
export function useServiceEngineEvents(name: string, enabled: boolean) {
  const [events, setEvents] = useState<ServiceEngineEvent[]>([]);
  useEffect(() => {
    if (!enabled || !name) {
      return;
    }
    let cancelled = false;
    const read = async () => {
      try {
        const result = await ListServiceEngineEvents(name);
        const data = (result.data ?? {}) as { events?: ServiceEngineEvent[] };
        if (!cancelled) {
          setEvents(data.events ?? []);
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
        }
      }
    };
    void read();
    const timer = window.setInterval(() => void read(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, name]);
  return events;
}

/** 日志文件列表 hook（挂载取一次 + 每次选中刷新）。 */
export function useServiceLogFiles(name: string, enabled: boolean) {
  const [files, setFiles] = useState<ServiceLogFile[]>([]);
  useEffect(() => {
    if (!enabled || !name) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await ListServiceLogFiles(name);
        const data = (result.data ?? {}) as { files?: ServiceLogFile[] };
        if (!cancelled) {
          setFiles(data.files ?? []);
        }
      } catch {
        if (!cancelled) {
          setFiles([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, name]);
  return files;
}

/** 单个日志文件尾部内容 hook（3 秒轮询刷新，服务运行中新日志可见；自动滚动依赖它）。 */
export function useServiceLogContent(name: string, file: string | null, enabled: boolean) {
  const [content, setContent] = useState('');
  useEffect(() => {
    if (!enabled || !name || !file) {
      setContent('');
      return;
    }
    let cancelled = false;
    const read = async () => {
      try {
        const result = await ReadServiceLogTail(name, file, 400);
        const data = (result.data ?? {}) as { content?: string };
        if (!cancelled) {
          setContent(data.content ?? '');
        }
      } catch {
        if (!cancelled) {
          setContent('');
        }
      }
    };
    void read();
    const timer = window.setInterval(() => void read(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, name, file]);
  return content;
}
