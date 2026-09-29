import { describe, expect, it } from 'vitest';
import { buildDefaultDeploy, deployProcessParams } from './defaultDeploy';
import type { ServiceDeploySnapshot } from '../../serviceRegistryStore';
import type { ServiceDetailInfo } from './useServiceDetail';

const info = (over: Partial<ServiceDetailInfo> = {}): ServiceDetailInfo => ({
  name: 'ORDER-SERVICE',
  installed: true,
  displayName: '订单服务',
  description: 'demo',
  state: 'Stopped',
  pid: 0,
  startType: 'Automatic',
  delayedAutoStart: false,
  binaryPathName: '',
  account: 'LocalSystem',
  dependencies: [],
  startedAt: 0,
  uptimeSeconds: 0,
  programFile: 'C:\\apps\\order\\order.jar',
  logDir: '',
  ...over,
});

describe('buildDefaultDeploy（无快照记录的默认注册参数）', () => {
  it('Java：默认 javaPath/jvmArgs 来自模板字段，-Xms/-Xmx 存 jvmArgs，programFile 保留 jar', () => {
    const deploy = buildDefaultDeploy('java', 'ORDER-SERVICE', info());
    expect(deploy).not.toBeNull();
    expect(deploy!.javaPath).toContain('java.exe');
    expect(deploy!.jvmArgs).toBe('-Xms2g -Xmx2g');
    expect(deploy!.programFile).toBe('C:\\apps\\order\\order.jar');
    expect(deploy!.workDir).toBe('C:\\apps\\order');
    expect(deploy!.displayName).toBe('订单服务');
    expect(deploy!.startType).toBe('Automatic');
  });

  it('启动类型 Disabled 落回 Automatic；无 info 时显示名用服务名', () => {
    const deploy = buildDefaultDeploy('java', 'ORDER-SERVICE', info({ startType: 'Disabled', displayName: '' }));
    expect(deploy!.startType).toBe('Automatic');
    expect(deploy!.displayName).toBe('ORDER-SERVICE');
  });

  it('未知服务类型返回 null（调用方走警告分支）', () => {
    expect(buildDefaultDeploy('unknown-type', 'X', info())).toBeNull();
  });
});

describe('deployProcessParams（注册请求的进程参数）', () => {
  const javaDeploy: ServiceDeploySnapshot = {
    displayName: '订单服务',
    programFile: 'C:\\apps\\order\\order.jar',
    javaPath: 'C:\\Java\\java.exe',
    jvmArgs: '-Xms2g -Xmx2g',
    startType: 'Automatic',
    restart: true,
  };

  it('Java：jvmArgs 拼上 -jar 成完整进程参数（对齐添加弹框 template.params）', () => {
    expect(deployProcessParams('java', javaDeploy)).toBe('-Xms2g -Xmx2g -jar "C:\\apps\\order\\order.jar"');
  });

  it('非 Java：params 即进程参数', () => {
    const redisDeploy: ServiceDeploySnapshot = {
      displayName: 'redis',
      programFile: 'C:\\redis\\redis-server.exe',
      params: '--port 6379',
      startType: 'Automatic',
      restart: true,
    };
    expect(deployProcessParams('redis', redisDeploy)).toBe('--port 6379');
  });
});
