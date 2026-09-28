import React, { useEffect } from 'react';
import '../v2-theme.css';
import '../components/home/ServiceHome.css';
import { ServiceHome } from '../components/home/ServiceHome';
import { ServiceTreeSidebar } from '../components/serviceTree/ServiceTreeSidebar';
import { useServiceRegistryStore, type ManagedServiceEntry } from '../serviceRegistryStore';

/**
 * 首页视觉走查专用 harness：`?devHarness=home` 时渲染独立的 ServiceHome，
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
  document.body.dataset.uiVersion = 'v2';
  document.body.dataset.theme = 'light';
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
        },
      };
    },
    ListWindowsServices: async () => ({ success: true, data: { services: harnessServiceList() } }),
    SampleServiceMetrics: async (names: string[]) => {
      harnessPollCount += 1;
      return { success: true, data: harnessMetrics(names) };
    },
    LocateServyEngine: async () => ({ success: true, data: { available: true, path: 'C:\\tools\\servy\\servy-10.1.exe' } }),
    ControlWindowsService: async (name: string, action: string) => {
      const target = action === 'stop' ? 'Stopped' : 'Running';
      if (HARNESS_STATES[name] !== undefined) {
        HARNESS_STATES[name] = target;
      }
      return { success: true, data: { name, action } };
    },
  };
}

export default function HomeHarness() {
  const [showSidebar, setShowSidebar] = React.useState(false);
  useEffect(() => {
    useServiceRegistryStore.setState({ services: HARNESS_SERVICES });
    setShowSidebar(new URLSearchParams(window.location.search).get('sidebar') === '1');
  }, []);

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
