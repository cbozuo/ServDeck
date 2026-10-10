export namespace app {
	
	export class AddServiceRequest {
	    mode: string;
	    serviceType: string;
	    name: string;
	    displayName: string;
	    description: string;
	    programFile: string;
	    params: string;
	    workDir: string;
	    startType: string;
	    restart: boolean;
	    rotate: boolean;
	    skipStart: boolean;
	    confName: string;
	    confContent: string;
	
	    static createFrom(source: any = {}) {
	        return new AddServiceRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.serviceType = source["serviceType"];
	        this.name = source["name"];
	        this.displayName = source["displayName"];
	        this.description = source["description"];
	        this.programFile = source["programFile"];
	        this.params = source["params"];
	        this.workDir = source["workDir"];
	        this.startType = source["startType"];
	        this.restart = source["restart"];
	        this.rotate = source["rotate"];
	        this.skipStart = source["skipStart"];
	        this.confName = source["confName"];
	        this.confContent = source["confContent"];
	    }
	}
	export class DownloadSourceConfig {
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadSourceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	    }
	}
	export class SecurityUpdateOptions {
	    allowPartial?: boolean;
	    writeBackup?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SecurityUpdateOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.allowPartial = source["allowPartial"];
	        this.writeBackup = source["writeBackup"];
	    }
	}
	export class RestartSecurityUpdateRequest {
	    migrationId?: string;
	    sourceType: string;
	    rawPayload?: string;
	    options?: SecurityUpdateOptions;
	
	    static createFrom(source: any = {}) {
	        return new RestartSecurityUpdateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.migrationId = source["migrationId"];
	        this.sourceType = source["sourceType"];
	        this.rawPayload = source["rawPayload"];
	        this.options = this.convertValues(source["options"], SecurityUpdateOptions);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RetrySecurityUpdateRequest {
	    migrationId?: string;
	
	    static createFrom(source: any = {}) {
	        return new RetrySecurityUpdateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.migrationId = source["migrationId"];
	    }
	}
	export class SecurityUpdateIssue {
	    id: string;
	    scope: string;
	    refId?: string;
	    title: string;
	    severity: string;
	    status: string;
	    reasonCode: string;
	    action: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new SecurityUpdateIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.scope = source["scope"];
	        this.refId = source["refId"];
	        this.title = source["title"];
	        this.severity = source["severity"];
	        this.status = source["status"];
	        this.reasonCode = source["reasonCode"];
	        this.action = source["action"];
	        this.message = source["message"];
	    }
	}
	
	export class SecurityUpdateSummary {
	    total: number;
	    updated: number;
	    pending: number;
	    skipped: number;
	    failed: number;
	
	    static createFrom(source: any = {}) {
	        return new SecurityUpdateSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.updated = source["updated"];
	        this.pending = source["pending"];
	        this.skipped = source["skipped"];
	        this.failed = source["failed"];
	    }
	}
	export class SecurityUpdateStatus {
	    schemaVersion?: number;
	    migrationId?: string;
	    overallStatus: string;
	    sourceType?: string;
	    reminderVisible: boolean;
	    canStart: boolean;
	    canPostpone: boolean;
	    canRetry: boolean;
	    backupAvailable: boolean;
	    backupPath?: string;
	    startedAt?: string;
	    updatedAt?: string;
	    completedAt?: string;
	    postponedAt?: string;
	    summary: SecurityUpdateSummary;
	    issues: SecurityUpdateIssue[];
	    lastError?: string;
	
	    static createFrom(source: any = {}) {
	        return new SecurityUpdateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schemaVersion = source["schemaVersion"];
	        this.migrationId = source["migrationId"];
	        this.overallStatus = source["overallStatus"];
	        this.sourceType = source["sourceType"];
	        this.reminderVisible = source["reminderVisible"];
	        this.canStart = source["canStart"];
	        this.canPostpone = source["canPostpone"];
	        this.canRetry = source["canRetry"];
	        this.backupAvailable = source["backupAvailable"];
	        this.backupPath = source["backupPath"];
	        this.startedAt = source["startedAt"];
	        this.updatedAt = source["updatedAt"];
	        this.completedAt = source["completedAt"];
	        this.postponedAt = source["postponedAt"];
	        this.summary = this.convertValues(source["summary"], SecurityUpdateSummary);
	        this.issues = this.convertValues(source["issues"], SecurityUpdateIssue);
	        this.lastError = source["lastError"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class StartSecurityUpdateRequest {
	    sourceType: string;
	    rawPayload?: string;
	    options?: SecurityUpdateOptions;
	
	    static createFrom(source: any = {}) {
	        return new StartSecurityUpdateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceType = source["sourceType"];
	        this.rawPayload = source["rawPayload"];
	        this.options = this.convertValues(source["options"], SecurityUpdateOptions);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace connection {
	
	export class JVMDiagnosticConfig {
	    enabled?: boolean;
	    transport?: string;
	    baseUrl?: string;
	    targetId?: string;
	    apiKey?: string;
	    allowObserveCommands?: boolean;
	    allowTraceCommands?: boolean;
	    allowMutatingCommands?: boolean;
	    timeoutSeconds?: number;
	
	    static createFrom(source: any = {}) {
	        return new JVMDiagnosticConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.transport = source["transport"];
	        this.baseUrl = source["baseUrl"];
	        this.targetId = source["targetId"];
	        this.apiKey = source["apiKey"];
	        this.allowObserveCommands = source["allowObserveCommands"];
	        this.allowTraceCommands = source["allowTraceCommands"];
	        this.allowMutatingCommands = source["allowMutatingCommands"];
	        this.timeoutSeconds = source["timeoutSeconds"];
	    }
	}
	export class JVMAgentConfig {
	    enabled?: boolean;
	    baseUrl?: string;
	    apiKey?: string;
	    timeoutSeconds?: number;
	
	    static createFrom(source: any = {}) {
	        return new JVMAgentConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.baseUrl = source["baseUrl"];
	        this.apiKey = source["apiKey"];
	        this.timeoutSeconds = source["timeoutSeconds"];
	    }
	}
	export class JVMEndpointConfig {
	    enabled?: boolean;
	    baseUrl?: string;
	    apiKey?: string;
	    timeoutSeconds?: number;
	
	    static createFrom(source: any = {}) {
	        return new JVMEndpointConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.baseUrl = source["baseUrl"];
	        this.apiKey = source["apiKey"];
	        this.timeoutSeconds = source["timeoutSeconds"];
	    }
	}
	export class JVMJMXConfig {
	    enabled?: boolean;
	    host?: string;
	    port?: number;
	    username?: string;
	    password?: string;
	    domainAllowlist?: string[];
	
	    static createFrom(source: any = {}) {
	        return new JVMJMXConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.domainAllowlist = source["domainAllowlist"];
	    }
	}
	export class JVMConfig {
	    environment?: string;
	    readOnly?: boolean;
	    allowedModes?: string[];
	    preferredMode?: string;
	    jmx?: JVMJMXConfig;
	    endpoint?: JVMEndpointConfig;
	    agent?: JVMAgentConfig;
	    diagnostic?: JVMDiagnosticConfig;
	
	    static createFrom(source: any = {}) {
	        return new JVMConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment = source["environment"];
	        this.readOnly = source["readOnly"];
	        this.allowedModes = source["allowedModes"];
	        this.preferredMode = source["preferredMode"];
	        this.jmx = this.convertValues(source["jmx"], JVMJMXConfig);
	        this.endpoint = this.convertValues(source["endpoint"], JVMEndpointConfig);
	        this.agent = this.convertValues(source["agent"], JVMAgentConfig);
	        this.diagnostic = this.convertValues(source["diagnostic"], JVMDiagnosticConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HTTPTunnelConfig {
	    host: string;
	    port: number;
	    user?: string;
	    password?: string;
	    encodeBase64?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HTTPTunnelConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.encodeBase64 = source["encodeBase64"];
	    }
	}
	export class ProxyConfig {
	    type: string;
	    host: string;
	    port: number;
	    user?: string;
	    password?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProxyConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	    }
	}
	export class SSHConfig {
	    host: string;
	    port: number;
	    user: string;
	    password: string;
	    keyPath: string;
	    knownHostsPath?: string;
	    hostKeyFingerprint?: string;
	
	    static createFrom(source: any = {}) {
	        return new SSHConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.keyPath = source["keyPath"];
	        this.knownHostsPath = source["knownHostsPath"];
	        this.hostKeyFingerprint = source["hostKeyFingerprint"];
	    }
	}
	export class ConnectionProtectionConfig {
	    restrictDataEdit?: boolean;
	    restrictStructureEdit?: boolean;
	    restrictScriptExecution?: boolean;
	    restrictDataImport?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionProtectionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.restrictDataEdit = source["restrictDataEdit"];
	        this.restrictStructureEdit = source["restrictStructureEdit"];
	        this.restrictScriptExecution = source["restrictScriptExecution"];
	        this.restrictDataImport = source["restrictDataImport"];
	    }
	}
	export class ConnectionConfig {
	    id?: string;
	    type: string;
	    host: string;
	    port: number;
	    user: string;
	    password: string;
	    savePassword?: boolean;
	    database: string;
	    readOnly?: boolean;
	    protection?: ConnectionProtectionConfig;
	    useSSL?: boolean;
	    sslMode?: string;
	    sslCAPath?: string;
	    sslCertPath?: string;
	    sslKeyPath?: string;
	    useSSH: boolean;
	    ssh: SSHConfig;
	    useProxy?: boolean;
	    proxy?: ProxyConfig;
	    useHttpTunnel?: boolean;
	    httpTunnel?: HTTPTunnelConfig;
	    driver?: string;
	    dsn?: string;
	    connectionParams?: string;
	    timeout?: number;
	    queryTimeout?: number;
	    keepAliveEnabled?: boolean;
	    keepAliveIntervalMinutes?: number;
	    keepAliveSQL?: string;
	    redisDB?: number;
	    redisSentinelMaster?: string;
	    redisSentinelUser?: string;
	    redisSentinelPassword?: string;
	    uri?: string;
	    clickHouseProtocol?: string;
	    oceanBaseProtocol?: string;
	    hosts?: string[];
	    topology?: string;
	    mysqlReplicaUser?: string;
	    mysqlReplicaPassword?: string;
	    replicaSet?: string;
	    authSource?: string;
	    readPreference?: string;
	    mongoSrv?: boolean;
	    mongoAuthMechanism?: string;
	    mongoReplicaUser?: string;
	    mongoReplicaPassword?: string;
	    jvm?: JVMConfig;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.savePassword = source["savePassword"];
	        this.database = source["database"];
	        this.readOnly = source["readOnly"];
	        this.protection = this.convertValues(source["protection"], ConnectionProtectionConfig);
	        this.useSSL = source["useSSL"];
	        this.sslMode = source["sslMode"];
	        this.sslCAPath = source["sslCAPath"];
	        this.sslCertPath = source["sslCertPath"];
	        this.sslKeyPath = source["sslKeyPath"];
	        this.useSSH = source["useSSH"];
	        this.ssh = this.convertValues(source["ssh"], SSHConfig);
	        this.useProxy = source["useProxy"];
	        this.proxy = this.convertValues(source["proxy"], ProxyConfig);
	        this.useHttpTunnel = source["useHttpTunnel"];
	        this.httpTunnel = this.convertValues(source["httpTunnel"], HTTPTunnelConfig);
	        this.driver = source["driver"];
	        this.dsn = source["dsn"];
	        this.connectionParams = source["connectionParams"];
	        this.timeout = source["timeout"];
	        this.queryTimeout = source["queryTimeout"];
	        this.keepAliveEnabled = source["keepAliveEnabled"];
	        this.keepAliveIntervalMinutes = source["keepAliveIntervalMinutes"];
	        this.keepAliveSQL = source["keepAliveSQL"];
	        this.redisDB = source["redisDB"];
	        this.redisSentinelMaster = source["redisSentinelMaster"];
	        this.redisSentinelUser = source["redisSentinelUser"];
	        this.redisSentinelPassword = source["redisSentinelPassword"];
	        this.uri = source["uri"];
	        this.clickHouseProtocol = source["clickHouseProtocol"];
	        this.oceanBaseProtocol = source["oceanBaseProtocol"];
	        this.hosts = source["hosts"];
	        this.topology = source["topology"];
	        this.mysqlReplicaUser = source["mysqlReplicaUser"];
	        this.mysqlReplicaPassword = source["mysqlReplicaPassword"];
	        this.replicaSet = source["replicaSet"];
	        this.authSource = source["authSource"];
	        this.readPreference = source["readPreference"];
	        this.mongoSrv = source["mongoSrv"];
	        this.mongoAuthMechanism = source["mongoAuthMechanism"];
	        this.mongoReplicaUser = source["mongoReplicaUser"];
	        this.mongoReplicaPassword = source["mongoReplicaPassword"];
	        this.jvm = this.convertValues(source["jvm"], JVMConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SchemaVisibilityRule {
	    mode: string;
	    schemas?: string[];
	
	    static createFrom(source: any = {}) {
	        return new SchemaVisibilityRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.schemas = source["schemas"];
	    }
	}
	export class ConnectionVisibilityInput {
	    id: string;
	    includeDatabases?: string[];
	    includeDatabasePatterns?: string[];
	    excludeDatabasePatterns?: string[];
	    includeRedisDatabases?: number[];
	    schemaVisibilityByDatabase?: Record<string, SchemaVisibilityRule>;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionVisibilityInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.includeDatabases = source["includeDatabases"];
	        this.includeDatabasePatterns = source["includeDatabasePatterns"];
	        this.excludeDatabasePatterns = source["excludeDatabasePatterns"];
	        this.includeRedisDatabases = source["includeRedisDatabases"];
	        this.schemaVisibilityByDatabase = this.convertValues(source["schemaVisibilityByDatabase"], SchemaVisibilityRule, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GlobalProxyView {
	    enabled: boolean;
	    type: string;
	    host: string;
	    port: number;
	    user?: string;
	    password?: string;
	    hasPassword?: boolean;
	    secretRef?: string;
	
	    static createFrom(source: any = {}) {
	        return new GlobalProxyView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.type = source["type"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.hasPassword = source["hasPassword"];
	        this.secretRef = source["secretRef"];
	    }
	}
	
	
	
	
	
	
	
	export class QueryResult {
	    success: boolean;
	    message: string;
	    data: any;
	    fields?: string[];
	    messages?: string[];
	    partial?: boolean;
	    executedCount?: number;
	    failedIndex?: number;
	    boundaryMode?: string;
	    commitMode?: string;
	    warnings?: string[];
	    outcomeUnknown?: boolean;
	    failedObjectTypes?: string[];
	    retryable?: boolean;
	    truncated?: boolean;
	    scannedCount?: number;
	    durationMs?: number;
	    queryId?: string;
	    cancellationState?: string;
	    transactionId?: string;
	    transactionPending?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.data = source["data"];
	        this.fields = source["fields"];
	        this.messages = source["messages"];
	        this.partial = source["partial"];
	        this.executedCount = source["executedCount"];
	        this.failedIndex = source["failedIndex"];
	        this.boundaryMode = source["boundaryMode"];
	        this.commitMode = source["commitMode"];
	        this.warnings = source["warnings"];
	        this.outcomeUnknown = source["outcomeUnknown"];
	        this.failedObjectTypes = source["failedObjectTypes"];
	        this.retryable = source["retryable"];
	        this.truncated = source["truncated"];
	        this.scannedCount = source["scannedCount"];
	        this.durationMs = source["durationMs"];
	        this.queryId = source["queryId"];
	        this.cancellationState = source["cancellationState"];
	        this.transactionId = source["transactionId"];
	        this.transactionPending = source["transactionPending"];
	    }
	}
	
	export class SaveGlobalProxyInput {
	    enabled: boolean;
	    type: string;
	    host: string;
	    port: number;
	    user?: string;
	    password?: string;
	    clearPassword?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SaveGlobalProxyInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.type = source["type"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.clearPassword = source["clearPassword"];
	    }
	}
	export class SavedConnectionInput {
	    id?: string;
	    name: string;
	    createdAt?: number;
	    environmentType?: string;
	    config: ConnectionConfig;
	    includeDatabases?: string[];
	    includeDatabasePatterns?: string[];
	    excludeDatabasePatterns?: string[];
	    includeRedisDatabases?: number[];
	    schemaVisibilityByDatabase?: Record<string, SchemaVisibilityRule>;
	    iconType?: string;
	    iconColor?: string;
	    clearPrimaryPassword?: boolean;
	    clearSSHPassword?: boolean;
	    clearProxyPassword?: boolean;
	    clearHttpTunnelPassword?: boolean;
	    clearMySQLReplicaPassword?: boolean;
	    clearMongoReplicaPassword?: boolean;
	    clearRedisSentinelPassword?: boolean;
	    clearOpaqueURI?: boolean;
	    clearOpaqueDSN?: boolean;
	    clearJVMJMXPassword?: boolean;
	    clearJVMEndpointAPIKey?: boolean;
	    clearJVMAgentAPIKey?: boolean;
	    clearJVMDiagnosticAPIKey?: boolean;
	    clearSensitiveConnectionParams?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SavedConnectionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.createdAt = source["createdAt"];
	        this.environmentType = source["environmentType"];
	        this.config = this.convertValues(source["config"], ConnectionConfig);
	        this.includeDatabases = source["includeDatabases"];
	        this.includeDatabasePatterns = source["includeDatabasePatterns"];
	        this.excludeDatabasePatterns = source["excludeDatabasePatterns"];
	        this.includeRedisDatabases = source["includeRedisDatabases"];
	        this.schemaVisibilityByDatabase = this.convertValues(source["schemaVisibilityByDatabase"], SchemaVisibilityRule, true);
	        this.iconType = source["iconType"];
	        this.iconColor = source["iconColor"];
	        this.clearPrimaryPassword = source["clearPrimaryPassword"];
	        this.clearSSHPassword = source["clearSSHPassword"];
	        this.clearProxyPassword = source["clearProxyPassword"];
	        this.clearHttpTunnelPassword = source["clearHttpTunnelPassword"];
	        this.clearMySQLReplicaPassword = source["clearMySQLReplicaPassword"];
	        this.clearMongoReplicaPassword = source["clearMongoReplicaPassword"];
	        this.clearRedisSentinelPassword = source["clearRedisSentinelPassword"];
	        this.clearOpaqueURI = source["clearOpaqueURI"];
	        this.clearOpaqueDSN = source["clearOpaqueDSN"];
	        this.clearJVMJMXPassword = source["clearJVMJMXPassword"];
	        this.clearJVMEndpointAPIKey = source["clearJVMEndpointAPIKey"];
	        this.clearJVMAgentAPIKey = source["clearJVMAgentAPIKey"];
	        this.clearJVMDiagnosticAPIKey = source["clearJVMDiagnosticAPIKey"];
	        this.clearSensitiveConnectionParams = source["clearSensitiveConnectionParams"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SavedConnectionView {
	    id: string;
	    name: string;
	    createdAt?: number;
	    environmentType?: string;
	    config: ConnectionConfig;
	    includeDatabases?: string[];
	    includeDatabasePatterns?: string[];
	    excludeDatabasePatterns?: string[];
	    includeRedisDatabases?: number[];
	    schemaVisibilityByDatabase?: Record<string, SchemaVisibilityRule>;
	    iconType?: string;
	    iconColor?: string;
	    secretRef?: string;
	    hasPrimaryPassword?: boolean;
	    hasSSHPassword?: boolean;
	    hasProxyPassword?: boolean;
	    hasHttpTunnelPassword?: boolean;
	    hasMySQLReplicaPassword?: boolean;
	    hasMongoReplicaPassword?: boolean;
	    hasRedisSentinelPassword?: boolean;
	    hasOpaqueURI?: boolean;
	    hasOpaqueDSN?: boolean;
	    hasJVMJMXPassword?: boolean;
	    hasJVMEndpointAPIKey?: boolean;
	    hasJVMAgentAPIKey?: boolean;
	    hasJVMDiagnosticAPIKey?: boolean;
	    hasSensitiveConnectionParams?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SavedConnectionView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.createdAt = source["createdAt"];
	        this.environmentType = source["environmentType"];
	        this.config = this.convertValues(source["config"], ConnectionConfig);
	        this.includeDatabases = source["includeDatabases"];
	        this.includeDatabasePatterns = source["includeDatabasePatterns"];
	        this.excludeDatabasePatterns = source["excludeDatabasePatterns"];
	        this.includeRedisDatabases = source["includeRedisDatabases"];
	        this.schemaVisibilityByDatabase = this.convertValues(source["schemaVisibilityByDatabase"], SchemaVisibilityRule, true);
	        this.iconType = source["iconType"];
	        this.iconColor = source["iconColor"];
	        this.secretRef = source["secretRef"];
	        this.hasPrimaryPassword = source["hasPrimaryPassword"];
	        this.hasSSHPassword = source["hasSSHPassword"];
	        this.hasProxyPassword = source["hasProxyPassword"];
	        this.hasHttpTunnelPassword = source["hasHttpTunnelPassword"];
	        this.hasMySQLReplicaPassword = source["hasMySQLReplicaPassword"];
	        this.hasMongoReplicaPassword = source["hasMongoReplicaPassword"];
	        this.hasRedisSentinelPassword = source["hasRedisSentinelPassword"];
	        this.hasOpaqueURI = source["hasOpaqueURI"];
	        this.hasOpaqueDSN = source["hasOpaqueDSN"];
	        this.hasJVMJMXPassword = source["hasJVMJMXPassword"];
	        this.hasJVMEndpointAPIKey = source["hasJVMEndpointAPIKey"];
	        this.hasJVMAgentAPIKey = source["hasJVMAgentAPIKey"];
	        this.hasJVMDiagnosticAPIKey = source["hasJVMDiagnosticAPIKey"];
	        this.hasSensitiveConnectionParams = source["hasSensitiveConnectionParams"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class TestGlobalProxyInput {
	    proxy: SaveGlobalProxyInput;
	    url: string;
	    timeoutSeconds?: number;
	
	    static createFrom(source: any = {}) {
	        return new TestGlobalProxyInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.proxy = this.convertValues(source["proxy"], SaveGlobalProxyInput);
	        this.url = source["url"];
	        this.timeoutSeconds = source["timeoutSeconds"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace jvm {
	
	export class ChangeRequest {
	    providerMode: string;
	    resourceId: string;
	    action: string;
	    reason: string;
	    source?: string;
	    expectedVersion?: string;
	    confirmationToken?: string;
	    payload?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new ChangeRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.providerMode = source["providerMode"];
	        this.resourceId = source["resourceId"];
	        this.action = source["action"];
	        this.reason = source["reason"];
	        this.source = source["source"];
	        this.expectedVersion = source["expectedVersion"];
	        this.confirmationToken = source["confirmationToken"];
	        this.payload = source["payload"];
	    }
	}
	export class DiagnosticCommandRequest {
	    sessionId: string;
	    commandId: string;
	    command: string;
	    source?: string;
	    reason?: string;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticCommandRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.commandId = source["commandId"];
	        this.command = source["command"];
	        this.source = source["source"];
	        this.reason = source["reason"];
	    }
	}
	export class DiagnosticSessionRequest {
	    title?: string;
	    reason?: string;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticSessionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.reason = source["reason"];
	    }
	}

}

export namespace nativewindow {
	
	export class HostStateRequest {
	    id: string;
	    revision: number;
	    storeState: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new HostStateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.revision = source["revision"];
	        this.storeState = source["storeState"];
	    }
	}
	export class OpenRequest {
	    id?: string;
	    kind: string;
	    title: string;
	    payload?: any;
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new OpenRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.title = source["title"];
	        this.payload = source["payload"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class WindowBounds {
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new WindowBounds(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class OperationResult {
	    success: boolean;
	    message?: string;
	    id?: string;
	    bounds?: WindowBounds;
	    visibilityRevision?: number;
	    applied?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new OperationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.id = source["id"];
	        this.bounds = this.convertValues(source["bounds"], WindowBounds);
	        this.visibilityRevision = source["visibilityRevision"];
	        this.applied = source["applied"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class WindowInfo {
	    id: string;
	    kind: string;
	    title: string;
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	    pid?: number;
	    openedAt: number;
	    ready: boolean;
	    closeSent: boolean;
	    hidden?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WindowInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.title = source["title"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.pid = source["pid"];
	        this.openedAt = source["openedAt"];
	        this.ready = source["ready"];
	        this.closeSent = source["closeSent"];
	        this.hidden = source["hidden"];
	    }
	}

}

