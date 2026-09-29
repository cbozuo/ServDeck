import { SERVICE_TEMPLATES, type ServiceTemplate } from '../../addService/serviceTemplates';
import type { ServiceDeploySnapshot } from '../../serviceRegistryStore';
import type { ServiceDetailInfo } from './useServiceDetail';

const templateOf = (serviceType: string): ServiceTemplate | undefined =>
  (SERVICE_TEMPLATES as Record<string, ServiceTemplate | undefined>)[serviceType];

/**
 * 无参数快照时的默认注册参数（模板字段默认值 + 已知事实：SCM 详情/纳管记录）。
 * detailRules 的「纳管停止态注册 = 接入托管，参数可用模板默认补全」即走此口径：
 * 历史遗留的无快照记录（旧版卸载清了 deploy）与外部纳管服务都经此获得可注册的参数。
 * 服务已卸载时 SCM 查不到程序路径，调用方应把纳管记录的 programFile/displayName 合进 info。
 */
export function buildDefaultDeploy(
  serviceType: string,
  name: string,
  info: Partial<ServiceDetailInfo> | null,
): ServiceDeploySnapshot | null {
  const template = templateOf(serviceType);
  if (!template) {
    return null;
  }
  const values: Record<string, string | boolean> = {};
  for (const field of template.fields) {
    values[field.key] = field.value;
  }
  const programFile = info?.programFile || '';
  const isJava = template.id === 'java';
  return {
    displayName: info?.displayName || name,
    description: info?.description || undefined,
    programFile,
    workDir: programFile ? programFile.replace(/[\\/][^\\/]*$/, '') : undefined,
    javaPath: isJava ? String(values.jvmPath ?? '') : undefined,
    jvmArgs: isJava ? String(values.jvmArgs ?? '') : undefined,
    params: isJava ? undefined : template.params(values, programFile) || undefined,
    // 启动类型跟随 SCM 现状（Disabled 无法启动，落回 Automatic）
    startType: info?.startType && info.startType !== 'Disabled' ? info.startType : 'Automatic',
    restart: true,
    rotate: true,
  };
}

/**
 * 注册请求的进程参数（--params / SERVY_PROCESS_PARAMETERS）。
 * Java 快照把参数存在 jvmArgs（不含 -jar），注册时要拼成完整进程参数串——
 * 与添加弹框 template.params(values, programFile) 同口径；非 Java 的 params 即现成参数。
 */
export function deployProcessParams(serviceType: string, deploy: ServiceDeploySnapshot): string {
  const template = templateOf(serviceType);
  if (!template) {
    return deploy.params ?? '';
  }
  if (template.id === 'java') {
    return template.params({ jvmArgs: deploy.jvmArgs ?? '' }, deploy.programFile);
  }
  return deploy.params ?? '';
}
