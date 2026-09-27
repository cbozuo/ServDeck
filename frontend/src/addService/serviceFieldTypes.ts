/**
 * 添加服务表单的字段类型（渲染层按类型分派控件）。
 * `directory` 会渲染成「可输入路径 + 浏览…按钮」的组合，按钮打开系统目录选择框。
 */
export type ServiceFieldType = 'text' | 'password' | 'path' | 'directory' | 'port' | 'select' | 'switch';

export type ServiceFieldValues = Record<string, string | boolean>;

/** 后端 ProbeWindowsService 返回的探测结果（connection.QueryResult.Data）。 */
export interface ServiceProbeResult {
  exists: boolean;
  state?: string;
  startType?: string;
  fileExists: boolean;
}

/** 后端 AddManagedService 返回的纳管结果。 */
export interface ServiceAddResult {
  managed: boolean;
  registered: boolean;
  name: string;
  logDir?: string;
  output?: string;
}

/** servy 引擎探测结果。 */
export interface ServyEngineStatus {
  available: boolean;
  path?: string;
  reason?: string;
}
