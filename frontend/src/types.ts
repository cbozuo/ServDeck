export interface SSHConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  keyPath?: string;
  knownHostsPath?: string;
  hostKeyFingerprint?: string;
}

export interface ProxyConfig {
  type: "socks5" | "http";
  host: string;
  port: number;
  user?: string;
  password?: string;
}

export interface HTTPTunnelConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  encodeBase64?: boolean;
}

export interface ConnectionProtectionConfig {
  restrictDataEdit?: boolean;
  restrictStructureEdit?: boolean;
  restrictScriptExecution?: boolean;
  restrictDataImport?: boolean;
}

export interface JVMJMXConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  domainAllowlist?: string[];
}

export interface JVMEndpointConfig {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  timeoutSeconds?: number;
}

export interface JVMAgentConfig {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  timeoutSeconds?: number;
}

export type JVMDiagnosticTransport = "agent-bridge" | "arthas-tunnel";

export interface JVMDiagnosticConfig {
  enabled?: boolean;
  transport?: JVMDiagnosticTransport;
  baseUrl?: string;
  targetId?: string;
  apiKey?: string;
  allowObserveCommands?: boolean;
  allowTraceCommands?: boolean;
  allowMutatingCommands?: boolean;
  timeoutSeconds?: number;
}

export interface JVMDiagnosticCapability {
  transport: JVMDiagnosticTransport;
  canOpenSession: boolean;
  canStream: boolean;
  canCancel: boolean;
  allowObserveCommands: boolean;
  allowTraceCommands: boolean;
  allowMutatingCommands: boolean;
  reason?: string;
}

export interface JVMDiagnosticSessionRequest {
  title?: string;
  reason?: string;
}

export interface JVMDiagnosticSessionHandle {
  sessionId: string;
  transport: string;
  startedAt: number;
}

export interface JVMDiagnosticCommandRequest {
  sessionId: string;
  commandId: string;
  command: string;
  source?: string;
  reason?: string;
}

export interface JVMDiagnosticEventChunk {
  sessionId: string;
  commandId?: string;
  event?: string;
  phase?: string;
  content?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface JVMDiagnosticAuditRecord {
  timestamp: number;
  connectionId: string;
  sessionId?: string;
  commandId?: string;
  transport: string;
  command: string;
  commandType?: string;
  source?: string;
  reason?: string;
  riskLevel?: string;
  status: string;
}

export interface JVMDiagnosticPlan {
  intent: string;
  transport: JVMDiagnosticTransport;
  command: string;
  riskLevel: "low" | "medium" | "high";
  reason: string;
  expectedSignals?: string[];
}

export interface JVMDiagnosticCommandDraft {
  sessionId?: string;
  command: string;
  source?: "manual" | "ai-plan";
  reason?: string;
}

export interface JVMConfig {
  environment?: "dev" | "uat" | "prod";
  readOnly?: boolean;
  allowedModes?: Array<"jmx" | "endpoint" | "agent">;
  preferredMode?: "jmx" | "endpoint" | "agent";
  jmx?: JVMJMXConfig;
  endpoint?: JVMEndpointConfig;
  agent?: JVMAgentConfig;
  diagnostic?: JVMDiagnosticConfig;
}

export interface JVMCapability {
  mode: "jmx" | "endpoint" | "agent";
  canBrowse: boolean;
  canWrite: boolean;
  canPreview: boolean;
  reason?: string;
  displayLabel: string;
}

export interface JVMMonitoringPoint {
  timestamp: number;
  heapUsedBytes?: number;
  heapCommittedBytes?: number;
  heapMaxBytes?: number;
  nonHeapUsedBytes?: number;
  nonHeapCommittedBytes?: number;
  gcCollectionCount?: number;
  gcCollectionTimeMs?: number;
  gcDeltaCount?: number;
  gcDeltaTimeMs?: number;
  threadCount?: number;
  daemonThreadCount?: number;
  peakThreadCount?: number;
  threadStateCounts?: Record<string, number>;
  loadedClassCount?: number;
  unloadedClassCount?: number;
  classLoadDelta?: number;
  processCpuLoad?: number;
  systemCpuLoad?: number;
  processRssBytes?: number;
  committedVirtualMemoryBytes?: number;
}

export interface JVMMonitoringRecentGCEvent {
  timestamp: number;
  name?: string;
  cause?: string;
  action?: string;
  durationMs?: number;
  beforeUsedBytes?: number;
  afterUsedBytes?: number;
}

export interface JVMMonitoringSessionState {
  connectionId: string;
  providerMode: "jmx" | "endpoint" | "agent";
  running: boolean;
  points?: JVMMonitoringPoint[];
  recentGcEvents?: JVMMonitoringRecentGCEvent[];
  availableMetrics?: string[];
  missingMetrics?: string[];
  providerWarnings?: string[];
}

export interface JVMResourceSummary {
  id: string;
  parentId?: string;
  kind: string;
  name: string;
  path: string;
  providerMode: "jmx" | "endpoint" | "agent";
  canRead: boolean;
  canWrite: boolean;
  hasChildren: boolean;
  sensitive?: boolean;
}

export interface JVMActionPayloadField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
}

export interface JVMActionDefinition {
  action: string;
  label?: string;
  description?: string;
  dangerous?: boolean;
  payloadFields?: JVMActionPayloadField[];
  payloadExample?: Record<string, any>;
}

export interface JVMValueSnapshot {
  resourceId: string;
  kind: string;
  format: string;
  version?: string;
  value: any;
  description?: string;
  sensitive?: boolean;
  supportedActions?: JVMActionDefinition[];
  metadata?: Record<string, any>;
}

export interface JVMChangePreview {
  allowed: boolean;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  summary: string;
  riskLevel: "low" | "medium" | "high";
  blockingReason?: string;
  before: JVMValueSnapshot;
  after: JVMValueSnapshot;
}

export interface JVMChangeRequest {
  providerMode: "jmx" | "endpoint" | "agent";
  resourceId: string;
  action: string;
  reason: string;
  source?: "manual" | "ai-plan";
  expectedVersion?: string;
  confirmationToken?: string;
  payload?: Record<string, any>;
}

export interface JVMApplyResult {
  status: string;
  message?: string;
  updatedValue: JVMValueSnapshot;
}

export interface JVMAuditRecord {
  timestamp: number;
  connectionId: string;
  providerMode: string;
  resourceId: string;
  action: string;
  reason: string;
  source?: string;
  result: string;
}

export interface ConnectionConfig {
  id?: string;
  type: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  savePassword?: boolean;
  database?: string;
  readOnly?: boolean;
  protection?: ConnectionProtectionConfig;
  useSSL?: boolean;
  sslMode?: "preferred" | "required" | "skip-verify" | "disable";
  sslCAPath?: string;
  sslCertPath?: string;
  sslKeyPath?: string;
  useSSH?: boolean;
  ssh?: SSHConfig;
  useProxy?: boolean;
  proxy?: ProxyConfig;
  useHttpTunnel?: boolean;
  httpTunnel?: HTTPTunnelConfig;
  driver?: string;
  dsn?: string;
  connectionParams?: string;
  timeout?: number;
  queryTimeout?: number; // transient per-request override; not a saved connection setting
  keepAliveEnabled?: boolean;
  keepAliveIntervalMinutes?: number;
  keepAliveSQL?: string;
  uri?: string; // Connection URI for copy/paste
  hosts?: string[]; // Multi-host addresses: host:port
  jvm?: JVMConfig;
}

export type ConnectionEnvironmentType =
  | 'production'
  | 'test'
  | 'development'
  | 'local';

export interface SavedConnection {
  id: string;
  name: string;
  createdAt?: number;
  environmentType?: ConnectionEnvironmentType;
  config: ConnectionConfig;
  secretRef?: string;
  hasPrimaryPassword?: boolean;
  hasSSHPassword?: boolean;
  hasProxyPassword?: boolean;
  hasHttpTunnelPassword?: boolean;
  hasOpaqueURI?: boolean;
  hasOpaqueDSN?: boolean;
  iconType?: string; // 自定义图标类型（如 'mysql','postgres'），不填则取 config.type
  iconColor?: string; // 自定义图标颜色（十六进制），不填则取类型默认色
}

export interface TabData {
  id: string;
  title: string;
  type:
    | "settings-center"
    | "service-detail"
    | "jvm-overview"
    | "jvm-resource"
    | "jvm-audit"
    | "jvm-diagnostic"
    | "jvm-monitoring";
  connectionId: string;
  /** ServDeck 纳管服务名（service-detail tab 的目标服务）。 */
  serviceName?: string;
  readOnly?: boolean;
  providerMode?: "jmx" | "endpoint" | "agent";
  resourcePath?: string;
  resourceKind?: string;
}

export interface JVMAIPlanContext {
  tabId: string;
  connectionId: string;
  providerMode: "jmx" | "endpoint" | "agent";
  resourcePath: string;
}

export interface JVMDiagnosticPlanContext {
  tabId: string;
  connectionId: string;
  transport: JVMDiagnosticTransport;
}

export type SecurityUpdateOverallStatus =
  | "not_detected"
  | "pending"
  | "postponed"
  | "in_progress"
  | "needs_attention"
  | "completed"
  | "rolled_back";

export type SecurityUpdateIssueScope =
  | "connection"
  | "global_proxy"
  | "ai_provider"
  | "system";
export type SecurityUpdateIssueSeverity = "high" | "medium" | "low";
export type SecurityUpdateItemStatus =
  | "pending"
  | "updated"
  | "needs_attention"
  | "skipped"
  | "failed";
export type SecurityUpdateIssueReasonCode =
  | "migration_required"
  | "secret_missing"
  | "field_invalid"
  | "write_conflict"
  | "validation_failed"
  | "environment_blocked";
export type SecurityUpdateIssueAction =
  | "open_connection"
  | "retry_update"
  | "view_details";

export interface SecurityUpdateSummary {
  total: number;
  updated: number;
  pending: number;
  skipped: number;
  failed: number;
}

export interface SecurityUpdateIssue {
  id: string;
  scope?: SecurityUpdateIssueScope;
  refId?: string;
  title?: string;
  severity?: SecurityUpdateIssueSeverity;
  status?: SecurityUpdateItemStatus;
  reasonCode?: SecurityUpdateIssueReasonCode;
  action?: SecurityUpdateIssueAction;
  message?: string;
}

export interface SecurityUpdateStatus {
  schemaVersion?: number;
  migrationId?: string;
  overallStatus: SecurityUpdateOverallStatus;
  sourceType?: "current_app_saved_config";
  reminderVisible?: boolean;
  canStart?: boolean;
  canPostpone?: boolean;
  canRetry?: boolean;
  backupAvailable?: boolean;
  backupPath?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  postponedAt?: string;
  summary: SecurityUpdateSummary;
  issues: SecurityUpdateIssue[];
  lastError?: string;
}
