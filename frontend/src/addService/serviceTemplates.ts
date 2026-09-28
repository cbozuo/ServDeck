import type { ServiceFieldType } from './serviceFieldTypes';

export interface ServiceFieldSpec {
  key: string;
  labelKey: string;
  type: ServiceFieldType;
  value: string | boolean;
  placeholder?: string;
  options?: string[];
  /**
   * 占几列，默认 1。
   * 2 表示跨满整行（`grid-column: 1 / -1`），专给目录这类路径可能很长的字段：
   * 三列栅格下 1 列只有约 170px，够放 `D:\rustfs\data`，放不下生产环境那种
   * `D:\infrastructure\object-storage\rustfs-prod-01\data`。
   * 带整行字段时请把它排在分区首位，避免在行中间打断栅格留下空洞。
   */
  span?: 1 | 2;
  /**
   * 该字段的默认值由「程序文件所在目录」派生，值为子目录名。
   * 例：程序文件 D:\rustfs\rustfs.exe + 'data' → D:\rustfs\data。
   * 用户手动改过之后不再跟随程序文件变化。
   */
  deriveFromProgramDir?: string;
}

export interface ServiceConfSpec {
  /** 配置文件名（默认写在程序同目录） */
  name: string;
  docUrl?: string;
  /** 由字段值生成配置内容；{{LOG_DIR}} 由后端写文件时替换为实际日志目录 */
  render: (values: Record<string, string | boolean>, programFile: string) => string;
  hintKey: string;
}

export interface ServiceTemplate {
  id: 'java' | 'mysql' | 'redis' | 'rustfs';
  labelKey: string;
  iconSrc: string;
  cardDescKey: string;
  sectionKey: string;
  file: string;
  fileHintKey: string;
  serviceName: string;
  displayNameKey: string;
  fields: ServiceFieldSpec[];
  /** servy install 的 -p 参数（服务进程可执行文件） */
  executable: (values: Record<string, string | boolean>) => string;
  /** 程序参数（--params）；返回空字符串表示无参数 */
  params: (values: Record<string, string | boolean>, programFile: string) => string;
  conf?: ServiceConfSpec;
}

const str = (values: Record<string, string | boolean>, key: string): string =>
  String(values[key] ?? '');

export const SERVICE_TEMPLATE_IDS = ['java', 'mysql', 'redis', 'rustfs'] as const;
export type ServiceTemplateId = (typeof SERVICE_TEMPLATE_IDS)[number];

export function isServiceTemplateId(value: string): value is ServiceTemplateId {
  return (SERVICE_TEMPLATE_IDS as readonly string[]).includes(value);
}

export const SERVICE_TEMPLATES: Record<ServiceTemplateId, ServiceTemplate> = {
  java: {
    id: 'java',
    labelKey: 'service.template.java.name',
    iconSrc: '/db-icons/java.svg',
    cardDescKey: 'service.template.java.desc',
    sectionKey: 'service.section.java',
    file: 'D:\\apps\\order\\order.jar',
    fileHintKey: 'service.fileHint.java',
    serviceName: 'order-service',
    displayNameKey: 'service.template.java.displayName',
    fields: [
      {
        key: 'jvmPath',
        labelKey: 'service.field.jvmPath',
        type: 'text',
        value: 'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
      },
      // JVM 参数即完整 JVM 串：堆内存滑杆把 -Xms/-Xmx 同值写在最前，其余参数原位保留
      // （与服务详情页「常用参数」同一交互）。程序启动参数由应用自身配置文件承载，不再单列。
      {
        key: 'jvmArgs',
        labelKey: 'service.field.jvmArgs',
        type: 'text',
        value: '-Xms2g -Xmx2g',
        placeholder: '-XX:+UseG1GC -Dspring.profiles.active=prod',
      },
    ],
    executable: (values) => str(values, 'jvmPath'),
    params: (values, programFile) =>
      [str(values, 'jvmArgs'), `-jar "${programFile}"`]
        .filter((part) => part.trim() !== '')
        .join(' '),
  },

  mysql: {
    id: 'mysql',
    labelKey: 'service.template.mysql.name',
    iconSrc: '/db-icons/mysql.svg',
    cardDescKey: 'service.template.mysql.desc',
    sectionKey: 'service.section.mysql',
    file: 'D:\\mysql\\bin\\mysqld.exe',
    fileHintKey: 'service.fileHint.mysql',
    serviceName: 'mysql',
    displayNameKey: 'service.template.mysql.displayName',
    fields: [
      { key: 'dataDir', labelKey: 'service.field.dataDir', type: 'directory', value: 'D:\\mysql\\data', span: 2 },
      { key: 'port', labelKey: 'service.field.port', type: 'port', value: '3306' },
      { key: 'maxConnections', labelKey: 'service.field.maxConnections', type: 'port', value: '151' },
      { key: 'charset', labelKey: 'service.field.charset', type: 'select', value: 'utf8mb4', options: ['utf8mb4', 'gbk', 'latin1'] },
    ],
    executable: () => '',
    params: (_values, programFile) => {
      // my.ini 与 mysqld.exe 同目录（bin 的上级）时用相对 defaults-file；这里直接给绝对路径
      const binDir = programFile.replace(/[\\/]mysqld\.exe$/i, '');
      return `--defaults-file="${binDir}\\my.ini" --console`;
    },
    conf: {
      name: 'my.ini',
      docUrl: 'https://dev.mysql.com/doc/refman/8.0/en/option-files.html',
      hintKey: 'service.confHint.mysql',
      render: (values, programFile) => {
        const basedir = programFile.replace(/[\\/]bin[\\/]mysqld\.exe$/i, '');
        return [
          '[mysqld]',
          `basedir=${basedir}`,
          `datadir=${str(values, 'dataDir')}`,
          `port=${str(values, 'port')}`,
          'character-set-server=' + str(values, 'charset'),
          `max_connections=${str(values, 'maxConnections')}`,
          'log-error={{LOG_DIR}}\\mysql-error.log',
        ].join('\n');
      },
    },
  },

  redis: {
    id: 'redis',
    labelKey: 'service.template.redis.name',
    iconSrc: '/db-icons/redis.ico',
    cardDescKey: 'service.template.redis.desc',
    sectionKey: 'service.section.redis',
    file: 'D:\\redis\\redis-server.exe',
    fileHintKey: 'service.fileHint.redis',
    serviceName: 'redis',
    displayNameKey: 'service.template.redis.displayName',
    fields: [
      { key: 'dataDir', labelKey: 'service.field.dataDir', type: 'directory', value: 'D:\\redis\\data', deriveFromProgramDir: 'data', span: 2 },
      { key: 'port', labelKey: 'service.field.port', type: 'port', value: '6379' },
      { key: 'password', labelKey: 'service.field.password', type: 'password', value: '' },
      { key: 'aof', labelKey: 'service.field.aof', type: 'switch', value: true },
      { key: 'maxMemory', labelKey: 'service.field.maxMemory', type: 'select', value: '1gb', options: ['256mb', '512mb', '1gb', '2gb', '4gb'] },
    ],
    executable: () => '',
    params: (_values, programFile) => {
      const dir = programFile.replace(/[\\/]redis-server\.exe$/i, '');
      return `"${dir}\\redis.conf"`;
    },
    conf: {
      name: 'redis.conf',
      docUrl: 'https://redis.io/docs/latest/operate/config/',
      hintKey: 'service.confHint.redis',
      render: (values) =>
        [
          'bind 0.0.0.0',
          `port ${str(values, 'port')}`,
          str(values, 'password') ? `requirepass ${str(values, 'password')}` : '# requirepass <empty>',
          `appendonly ${values.aof ? 'yes' : 'no'}`,
          `dir ${str(values, 'dataDir')}`,
          `maxmemory ${str(values, 'maxMemory')}`,
          'maxmemory-policy allkeys-lru',
          'logfile "{{LOG_DIR}}\\redis.log"',
        ].join('\n'),
    },
  },

  rustfs: {
    id: 'rustfs',
    labelKey: 'service.template.rustfs.name',
    iconSrc: '/db-icons/rustfs.png',
    cardDescKey: 'service.template.rustfs.desc',
    sectionKey: 'service.section.rustfs',
    file: 'D:\\rustfs\\rustfs.exe',
    fileHintKey: 'service.fileHint.rustfs',
    serviceName: 'rustfs-service',
    displayNameKey: 'service.template.rustfs.displayName',
    fields: [
      { key: 'dataDir', labelKey: 'service.field.dataDir', type: 'directory', value: 'D:\\rustfs\\data', deriveFromProgramDir: 'data', span: 2 },
      // 端口与日志级别都是短值，排在同一行；密钥/密码成对，排下一行。
      { key: 'apiPort', labelKey: 'service.field.apiPort', type: 'port', value: '9000' },
      { key: 'consolePort', labelKey: 'service.field.consolePort', type: 'port', value: '9001' },
      { key: 'logLevel', labelKey: 'service.field.logLevel', type: 'select', value: 'info', options: ['info', 'debug', 'warn', 'error'] },
      { key: 'accessKey', labelKey: 'service.field.accessKey', type: 'text', value: 'rustfsadmin' },
      { key: 'secretKey', labelKey: 'service.field.secretKey', type: 'password', value: 'rustfsadmin' },
    ],
    executable: () => '',
    params: (values) =>
      [
        `server "${str(values, 'dataDir')}"`,
        '--console-enable',
        `--console-address :${str(values, 'consolePort')}`,
        `--address :${str(values, 'apiPort')}`,
        `--access-key ${str(values, 'accessKey')}`,
        `--secret-key ${str(values, 'secretKey')}`,
      ].join(' '),
    conf: {
      name: 'rustfs.conf',
      docUrl: 'https://rustfs.com/docs/',
      hintKey: 'service.confHint.rustfs',
      render: (values) =>
        [
          `RUSTFS_ACCESS_KEY=${str(values, 'accessKey')}`,
          `RUSTFS_SECRET_KEY=${str(values, 'secretKey')}`,
          `RUSTFS_VOLUMES=${str(values, 'dataDir')}`,
          `RUSTFS_ADDRESS=0.0.0.0:${str(values, 'apiPort')}`,
          `RUSTFS_CONSOLE_ADDRESS=0.0.0.0:${str(values, 'consolePort')}`,
          'RUSTFS_CONSOLE_ENABLE=true',
          `RUST_LOG=${str(values, 'logLevel')}`,
          'RUSTFS_OBS_LOG_DIRECTORY={{LOG_DIR}}',
        ].join('\n'),
    },
  },
};

export const SERVICE_TEMPLATE_LIST: ServiceTemplate[] = [
  SERVICE_TEMPLATES.java,
  SERVICE_TEMPLATES.mysql,
  SERVICE_TEMPLATES.redis,
  SERVICE_TEMPLATES.rustfs,
];

/** servy install 的启动类型取值（透传给 servy --startupType） */
export const SERVICE_START_TYPES = [
  'Automatic',
  'Automatic (Delayed)',
  'Manual',
  'Disabled',
] as const;

/** 取程序文件所在目录；只写了文件名（没有分隔符）时返回空串。 */
export function programDirOf(programFile: string): string {
  const value = String(programFile ?? '').trim();
  const index = Math.max(value.lastIndexOf('\\'), value.lastIndexOf('/'));
  return index > 0 ? value.slice(0, index) : '';
}

/** 按「程序文件目录 + 子目录名」派生字段值；无法派生时回落到字段默认值。 */
export function deriveFieldValue(
  field: ServiceFieldSpec,
  programFile: string,
): string | undefined {
  if (!field.deriveFromProgramDir) {
    return undefined;
  }
  const dir = programDirOf(programFile);
  return dir ? `${dir}\\${field.deriveFromProgramDir}` : field.deriveFromProgramDir;
}

export function initialValues(template: ServiceTemplate): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  template.fields.forEach((field) => {
    values[field.key] = deriveFieldValue(field, template.file) ?? field.value;
  });
  return values;
}
