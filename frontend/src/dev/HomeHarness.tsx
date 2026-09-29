import React, { useEffect } from 'react';
import '../v2-theme.css';
import '../components/home/ServiceHome.css';
import { ServiceHome } from '../components/home/ServiceHome';
import { ServiceTreeSidebar } from '../components/serviceTree/ServiceTreeSidebar';
import { AddServiceModal } from '../components/AddServiceModal';
import { ServiceDetail } from '../components/serviceDetail/ServiceDetail';
import { useServiceDetailStore } from '../serviceDetailStore';
import { I18nProvider } from '../i18n/provider';
import { useServiceRegistryStore, type ManagedServiceEntry } from '../serviceRegistryStore';

/**
 * 首页视觉走查专用 harness：`?devHarness=home` 时渲染独立的 ServiceHome，
 * `?devHarness=add` 时直接打开添加服务弹窗（对照高保真走查启动类型 / 堆内存交互），
 * 用固定数据覆盖 wails 绑定（仅 DEV 构建生效），便于在浏览器中对照设计稿核对。
 */

const HARNESS_SERVICES: ManagedServiceEntry[] = [
  { name: 'order-service', serviceType: 'java', displayName: 'order-service', mode: 'register', programFile: '', addedAt: '2026-09-28T09:30:00Z', groupId: null },
  { name: 'MySQL80', serviceType: 'mysql', displayName: 'MySQL 数据库', mode: 'manage', programFile: '', addedAt: '2026-09-28T09:31:00Z', groupId: null },
  { name: 'rustfs-service', serviceType: 'rustfs', displayName: 'RustFS 对象存储', mode: 'register', programFile: '', addedAt: '2026-09-28T09:32:00Z', groupId: null },
  { name: 'redis-a', serviceType: 'redis', displayName: 'Redis 缓存 A', mode: 'manage', programFile: '', addedAt: '2026-09-28T09:33:00Z', groupId: null },
  { name: 'report-generator', serviceType: 'java', displayName: 'report-generator', mode: 'register', programFile: '', addedAt: '2026-09-28T09:34:00Z', groupId: null },
  { name: 'redis-b', serviceType: 'redis', displayName: 'Redis 缓存 B', mode: 'manage', programFile: '', addedAt: '2026-09-28T09:35:00Z', groupId: null },
  { name: 'mysql-slave', serviceType: 'mysql', displayName: 'MySQL 备库', mode: 'manage', programFile: '', addedAt: '2026-09-28T09:36:00Z', groupId: null },
  { name: 'backup-runner', serviceType: 'rustfs', displayName: 'backup-runner', mode: 'manage', programFile: '', addedAt: '2026-09-28T09:37:00Z', groupId: null },
];

const HARNESS_STATES: Record<string, string> = {
  'order-service': 'Running',
  MySQL80: 'Running',
  'rustfs-service': 'Running',
  'redis-a': 'Running',
  'report-generator': 'StartPending',
  'redis-b': 'Stopped',
  'mysql-slave': 'Stopped',
  'backup-runner': 'Paused',
};

const HARNESS_START_TYPES: Record<string, string> = {
  'order-service': 'Automatic',
  MySQL80: 'Automatic',
  'rustfs-service': 'Automatic',
  'redis-a': 'Manual',
  'report-generator': 'Automatic',
  'redis-b': 'Manual',
  'mysql-slave': 'Manual',
  'backup-runner': 'Disabled',
};

let harnessPollCount = 0;
let harnessDetailPoll = 0;
let harnessLogTick = 0;
let harnessCpuClock = 1000; // 进程累计 CPU（秒），每轮 +0.12s
let harnessHostCpuClock = 10_000; // 主机 CPU 累计时间（任意单位）

const harnessServiceList = () =>
  HARNESS_SERVICES.map((entry) => ({
    name: entry.name,
    displayName: entry.displayName,
    state: HARNESS_STATES[entry.name] ?? 'Unknown',
    startType: HARNESS_START_TYPES[entry.name] ?? 'Manual',
  }));

const harnessMetrics = (names: string[]) => ({
  services: names.map((name) => {
    const state = HARNESS_STATES[name] ?? 'Unknown';
    // 让 report-generator 在第 4 次轮询后转入 Stopped，制造一条事件用于走查。
    if (name === 'report-generator' && harnessPollCount >= 4) {
      return { name, state: 'Stopped', pid: 0, cpuTotal: 0, memBytes: 0 };
    }
    return {
      name,
      state,
      pid: state === 'Running' ? 4000 + name.length : 0,
      cpuTotal: harnessCpuClock + name.length * 0.7,
      memBytes: state === 'Running' ? 96 * 1024 * 1024 + name.length * 51 * 1024 * 1024 : 0,
    };
  }),
});

if (typeof window !== 'undefined') {
  // v2 主题 token 挂在 body[data-ui-version][data-theme] 上，harness 需要自行设置。
  // 主题跟随 ?theme= 参数（light/dark），供浅/深两套走查。
  document.body.dataset.uiVersion = 'v2';
  document.body.dataset.theme = new URLSearchParams(window.location.search).get('theme') || 'light';
  const go = ((window as any).go ??= {});
  go.app ??= {};
  go.app.App = {
    ...(go.app.App ?? {}),
    SampleHostResources: async () => {
      harnessCpuClock += 0.12;
      harnessHostCpuClock += 1000;
      // Windows 语义 kernel 含 idle：cpu% = (kernel+user-idle)/(kernel+user)，
      // idle 占比随轮询波动，让 CPU 卡的趋势线有形状。
      const busy = 0.16 + 0.1 * Math.abs(Math.sin(harnessPollCount * 1.3));
      return {
        success: true,
        data: {
          cpu: {
            kernel: harnessHostCpuClock * (busy + 0.06),
            user: harnessHostCpuClock * 0.05,
            idle: harnessHostCpuClock * (busy + 0.06) * 0.78,
          },
          memory: { total: 16 * 1024 ** 3, avail: 6.1 * 1024 ** 3, memoryLoad: 62 },
          disks: [{ drive: 'C:', total: 1024 ** 4, free: 588 * 1024 ** 3, used: 412 * 1024 ** 3, usedPct: 41 }],
          uptimeSeconds: 7 * 3600 + 14 * 60,
          netUpBps: 30.4 * 1024,
          netDownBps: 2.4 * 1024 * 1024,
          diskReadBps: 721 * 1024,
          diskWriteBps: 107 * 1024,
        },
      };
    },
    ListWindowsServices: async () => ({ success: true, data: { services: harnessServiceList() } }),
    SampleServiceMetrics: async (names: string[]) => {
      harnessPollCount += 1;
      return { success: true, data: harnessMetrics(names) };
    },
    LocateServyEngine: async () => {
      const missing = new URLSearchParams(window.location.search).get('engine') === 'missing';
      return missing
        ? { success: true, data: { available: false, reason: 'servy engine not found (set SERVDECK_SERVY_PATH)' } }
        : { success: true, data: { available: true, path: 'C:\\tools\\servy\\servy-cli.exe', version: '10.1.0' } };
    },
    ControlWindowsService: async (name: string, action: string) => {
      const target = action === 'stop' ? 'Stopped' : 'Running';
      if (HARNESS_STATES[name] !== undefined) {
        HARNESS_STATES[name] = target;
      }
      return { success: true, data: { name, action } };
    },
    ProbeWindowsService: async (name: string, file: string) => {
      // 与真实后端同口径：空服务名跳过 SCM 只查文件；只认少数演示路径的文件存在性，
      // 便于在浏览器里走查「程序文件为空 / 缺失 / 服务名为空」的按序报错分支。
      const fileExists = /^(C:\\Program Files\\Java\\|C:\\tools\\servy)/i.test(file);
      if (!name.trim()) {
        return { success: true, data: { exists: false, fileExists } };
      }
      return {
        success: true,
        data: { exists: HARNESS_SERVICES.some((entry) => entry.name === name), fileExists },
      };
    },
    DetectJavaRuntimes: async () => ({
      success: true,
      data: {
        candidates: [
          { version: 21, name: 'Oracle 21.0.1+12', path: 'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe' },
          { version: 17, name: 'Temurin 17.0.9+9', path: 'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe' },
          { version: 8, name: 'Zulu 8.0.392', path: 'C:\\Program Files\\Java\\zulu-8\\bin\\java.exe' },
        ],
      },
    }),
    SelectJdkExecutable: async () => ({ success: true, data: { path: '' } }),
    AddManagedService: async (payload: { name: string }) => ({
      success: true,
      data: { managed: true, registered: true, name: payload.name },
    }),
    SelectServiceProgramFile: async () => ({ success: true, data: { path: '' } }),
    SelectImageFile: async () => ({ success: true, data: { dataUrl: '' } }),
    SelectDirectory: async (_title: string, current: string) => ({
      success: true,
      data: current,
    }),
    OpenServiceLogDirectory: async () => ({ success: true, data: { name: 'harness' } }),
    GetWindowsServiceDetail: async (name: string) => ({
      success: true,
      data: (() => {
        const params = new URLSearchParams(window.location.search);
        // ?unreg=1 走查「未注册」形态（SCM 无此服务）；?state=stopped 走查停止态表单
        const unreg = params.get('unreg') === '1';
        const state = unreg ? '' : params.get('state') === 'stopped' ? 'Stopped' : 'Running';
        return {
          name,
          installed: !unreg,
          displayName: 'Java AI 服务项目',
          description: 'AI 平台的核心 Java 后端服务，负责推理请求编排与模型分发。',
          state,
          pid: state === 'Running' ? 4700 : 0,
          startType: 'Automatic',
          delayedAutoStart: false,
          binaryPathName: 'C:\\tools\\servy\\servy-cli.exe -p C:\\apps\\order\\order.jar',
          account: 'LocalSystem',
          dependencies: [],
          startedAt: Math.floor(Date.now() / 1000) - 3 * 3600 - 25 * 60,
          uptimeSeconds: 3 * 3600 + 25 * 60,
          programFile: 'C:\\apps\\order\\order.jar',
          logDir: 'C:\\Users\\Administrator\\.servdeck\\services\\' + name + '\\logs',
        };
      })(),
    }),
    SampleServiceDetailMetrics: async () => {
      harnessDetailPoll += 1;
      const wave = (seed: number) => 0.5 + 0.5 * Math.abs(Math.sin(harnessDetailPoll * 0.7 + seed));
      const params = new URLSearchParams(window.location.search);
      if (params.get('unreg') === '1' || params.get('state') === 'stopped') {
        return { success: true, data: { sample: { state: '', pid: 0, cpuTotal: 0, memBytes: 0, threads: 0, handles: 0, diskReadBps: 0, diskWriteBps: 0, netConns: 0 } } };
      }
      return {
        success: true,
        data: {
          sample: {
            state: 'Running',
            pid: 4700,
            cpuTotal: 100 + harnessDetailPoll * 0.8,
            memBytes: (600 + wave(2) * 90) * 1024 * 1024,
            threads: Math.round(40 + wave(3) * 8),
            handles: Math.round(320 + wave(4) * 60),
            diskReadBps: wave(5) * 90 * 1024,
            diskWriteBps: wave(6) * 40 * 1024,
            netConns: Math.round(3 + wave(7) * 4),
          },
        },
      };
    },
    CheckServicePorts: async (ports: number[]) => ({
      success: true,
      data: {
        ports: ports.map((p, i) => ({ port: p, listening: i !== 1 })),
        okCount: Math.max(0, ports.length - 1),
        total: ports.length,
      },
    }),
    ListServiceLogFiles: async () => ({
      success: true,
      data: {
        files: [
          { name: 'service-out.log', sizeBytes: 2 * 1024 * 1024, modifiedAt: Math.floor(Date.now() / 1000), kind: 'out' },
          { name: 'service-err.log', sizeBytes: 38 * 1024, modifiedAt: Math.floor(Date.now() / 1000) - 600, kind: 'err' },
          { name: 'service-out.log.1', sizeBytes: 5 * 1024 * 1024, modifiedAt: Math.floor(Date.now() / 1000) - 86400, kind: 'rot' },
        ],
      },
    }),
    ReadServiceLogTail: async () => {
      // 心跳行动态追加：走查「轮询新行带真实检测时刻、历史行不带时间」的时间标注逻辑
      harnessLogTick += 1;
      const base = [
        '2026-09-29 10:00:01 INFO  [main] Starting ServiceDeck demo service v2.4.1',
        '2026-09-29 10:00:03 INFO  [main] Spring context initialized in 2.1s',
        '2026-09-29 10:00:05 WARN  [pool-2] connection pool nearing capacity (18/20)',
        '2026-09-29 10:00:11 INFO  [http-nio-8080-exec-1] GET /api/health 200 12ms',
        '2026-09-29 10:00:22 ERROR [http-nio-8080-exec-3] upstream model service timeout (5000ms)',
      ];
      for (let i = 1; i <= Math.min(harnessLogTick - 1, 6); i++) {
        base.push(`INFO  [live] heartbeat #${i}`);
      }
      return { success: true, data: { content: base.join('\n') } };
    },
    ListServiceEngineEvents: async () => ({
      success: true,
      data: {
        events: [
          { at: Math.floor(Date.now() / 1000) - 3600, level: 'INFO', text: '[wec-ai-platform] Attempting to start service with a timeout of 45 seconds.' },
          { at: Math.floor(Date.now() / 1000) - 3540, level: 'WARN', text: "[wec-ai-platform] Service did not reach 'Running' status within the 45s timeout. It may still be initializing." },
          { at: Math.floor(Date.now() / 1000) - 3000, level: 'ERROR', text: "[wec-ai-platform] start: failed to start service: timeout" },
          { at: Math.floor(Date.now() / 1000) - 600, level: 'INFO', text: '[wec-ai-platform] Child process had already exited before the stop sequence ran.' },
        ],
      },
    }),
    GetServiceDirUsage: async () => ({ success: true, data: { bytes: 1.2 * 1024 ** 3 } }),
    SaveServiceConf: async () => ({ success: true, data: { saved: true } }),
    UninstallServyService: async () => ({ success: true, data: { name: '' } }),
  };
}

/** 添加服务弹窗走查：I18nProvider 固定简中文案，弹窗常开。 */
function AddServiceHarness() {
  return (
    <div data-ui-version="v2" data-theme="light">
      <I18nProvider preference="zh-CN" onPreferenceChange={() => undefined}>
        <AddServiceModal open onClose={() => undefined} />
      </I18nProvider>
    </div>
  );
}

export default function HomeHarness() {
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const params = new URLSearchParams(window.location.search);
  useEffect(() => {
    useServiceRegistryStore.setState({ services: params.get('empty') === '1' ? [] : HARNESS_SERVICES });
    setShowSidebar(params.get('sidebar') === '1');
    setShowAdd(params.get('devHarness') === 'add');
    setShowDetail(params.get('devHarness') === 'detail');
    if (params.get('devHarness') === 'detail') {
      useServiceRegistryStore.setState({
        services: [{
          name: 'wec-ai-platform',
          serviceType: 'java',
          displayName: 'Java AI 服务项目',
          mode: 'register',
          programFile: 'C:\apps\order\order.jar',
          logDir: 'C:\Users\Administrator\.servdeck\services\wec-ai-platform\logs',
          addedAt: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
          groupId: null,
          deploy: {
            displayName: 'Java AI 服务项目',
            description: 'AI 平台的核心 Java 后端服务。',
            programFile: 'C:\apps\order\order.jar',
            workDir: 'C:\apps\order',
            javaPath: 'C:\Program Files\Java\jdk-21\bin\java.exe',
            jvmArgs: '-Xms2g -Xmx2g -XX:+UseG1GC -Dserver.port=8080',
            startType: 'Automatic',
            restart: true,
          },
        }],
        groups: [],
      });
      useServiceDetailStore.getState().open('wec-ai-platform');
    }
  }, []);

  if (showDetail) {
    return (
      <div data-ui-version='v2' data-theme={new URLSearchParams(window.location.search).get('theme') || 'light'} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--gn-bg-app)' }}>
        <I18nProvider preference='zh-CN' onPreferenceChange={() => undefined}>
          <ServiceDetail name='wec-ai-platform' />
        </I18nProvider>
      </div>
    );
  }

  if (showAdd) {
    return <AddServiceHarness />;
  }

  if (showSidebar) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--gn-bg-app)', display: 'flex' }}>
        <div
          data-ui-version="v2"
          data-theme="light"
          style={{ width: 268, height: '100vh', flexShrink: 0, background: 'var(--gn-bg-panel)', borderRight: '1px solid var(--gn-br-1)' }}
        >
          <ServiceTreeSidebar onAddService={() => undefined} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ServiceHome onAddService={() => undefined} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gn-bg-app)' }}>
      <ServiceHome onAddService={() => undefined} />
    </div>
  );
}
