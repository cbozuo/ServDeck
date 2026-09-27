import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  deriveFieldValue,
  initialValues,
  programDirOf,
  SERVICE_TEMPLATE_LIST,
  SERVICE_TEMPLATES,
} from './serviceTemplates';
import { buildServyPreviewCommand } from './useAddServiceForm';



describe('service directory fields', () => {
  it('takes the program file directory and strips the file name', () => {
    expect(programDirOf('D:\\rustfs\\rustfs.exe')).toBe('D:\\rustfs');
    expect(programDirOf('D:/rustfs/rustfs.exe')).toBe('D:/rustfs');
    expect(programDirOf('rustfs.exe')).toBe('');
    expect(programDirOf('')).toBe('');
  });

  it('derives the data directory under the program file directory', () => {
    const dataDirField = SERVICE_TEMPLATES.rustfs.fields.find((field) => field.key === 'dataDir');
    expect(dataDirField?.type).toBe('directory');
    expect(deriveFieldValue(dataDirField!, 'D:\\rustfs\\rustfs.exe')).toBe('D:\\rustfs\\data');
    expect(deriveFieldValue(dataDirField!, 'C:\\apps\\rustfs\\rustfs.exe')).toBe('C:\\apps\\rustfs\\data');
    // 程序文件里没有目录分隔符时回落到子目录名本身
    expect(deriveFieldValue(dataDirField!, 'rustfs.exe')).toBe('data');
  });

  it('keeps every data directory field editable and browsable', () => {
    const withDataDir = SERVICE_TEMPLATE_LIST
      .map((template) => ({ template, field: template.fields.find((item) => item.key === 'dataDir') }))
      .filter((entry) => entry.field !== undefined);
    expect(withDataDir.map((entry) => entry.template.id)).toEqual(['mysql', 'redis', 'rustfs']);
    withDataDir.forEach(({ template, field }) => {
      // path → directory，渲染层才会给出「浏览…」按钮
      expect(field?.type, template.id).toBe('directory');
      expect(String(initialValues(template).dataDir).length, template.id).toBeGreaterThan(0);
    });
  });

  // 目录路径可能很长，1 列只有约 170px，放不下生产环境的路径。
  // 整行（span 2）后输入框约 632px，一屏可显示约 92 个字符。
  it('gives every data directory field the full row and puts it first', () => {
    SERVICE_TEMPLATE_LIST.forEach((template) => {
      const index = template.fields.findIndex((item) => item.key === 'dataDir');
      if (index === -1) {
        return;
      }
      // 排在行中间会在三列栅格上留下空洞，必须落在分区首位
      expect(index, template.id).toBe(0);
      expect(template.fields[index].span, template.id).toBe(2);
    });
  });

  it('does not derive values for fields without deriveFromProgramDir', () => {
    const portField = SERVICE_TEMPLATES.rustfs.fields.find((field) => field.key === 'apiPort');
    expect(deriveFieldValue(portField!, 'D:\\rustfs\\rustfs.exe')).toBeUndefined();
  });
});

describe('add service templates', () => {
  it('supports exactly the four shipped service types', () => {
    expect(SERVICE_TEMPLATE_LIST.map((item) => item.id)).toEqual([
      'java',
      'mysql',
      'redis',
      'rustfs',
    ]);
    expect(Object.keys(SERVICE_TEMPLATES)).toHaveLength(4);
  });

  it('every template exposes servy executable resolution and card metadata', () => {
    for (const template of SERVICE_TEMPLATE_LIST) {
      expect(template.iconSrc.startsWith('/db-icons/')).toBe(true);
      expect(template.fields.length).toBeGreaterThan(0);
      expect(() => template.executable({})).not.toThrow();
      expect(() => template.params({}, template.file)).not.toThrow();
    }
  });

  it('rustfs keeps the same params wording as the reference bat script', () => {
    const params = SERVICE_TEMPLATES.rustfs.params({
      dataDir: 'D:\\rustfs\\data',
      apiPort: '9000',
      consolePort: '9001',
      accessKey: 'rustfsadmin',
      secretKey: 'secret',
    }, 'D:\\rustfs\\rustfs.exe');
    expect(params).toContain('server "D:\\rustfs\\data"');
    expect(params).toContain('--console-enable');
    expect(params).toContain('--address :9000');
  });

  it('mysql compiles a defaults-file param pointing at the generated my.ini', () => {
    const params = SERVICE_TEMPLATES.mysql.params({}, 'D:\\mysql\\bin\\mysqld.exe');
    expect(params).toContain('--defaults-file="D:\\mysql\\bin\\my.ini"');
    const conf = SERVICE_TEMPLATES.mysql.conf?.render(
      { dataDir: 'D:\\mysql\\data', port: '3306', maxConnections: '151', charset: 'utf8mb4' },
      'D:\\mysql\\bin\\mysqld.exe',
    );
    expect(conf).toContain('[mysqld]');
    expect(conf).toContain('port=3306');
    expect(conf).toContain('{{LOG_DIR}}');
  });
});

describe('servy preview command', () => {
  const template = SERVICE_TEMPLATES.rustfs;
  const values = {
    dataDir: 'D:\\rustfs\\data',
    apiPort: '9000',
    consolePort: '9001',
    accessKey: 'k',
    secretKey: 's',
    logLevel: 'info',
  };
  const basic = {
    programFile: 'D:\\rustfs\\rustfs.exe',
    serviceName: 'rustfs-service',
    displayName: 'RustFS',
    startType: 'Automatic',
    restart: true,
  };

  it('builds install + start pair with the log directory placeholder', () => {
    const command = buildServyPreviewCommand(template, values, basic);
    expect(command).toContain('servy-10.1.exe install');
    expect(command).toContain('--name "rustfs-service"');
    expect(command).toContain('-p "D:\\rustfs\\rustfs.exe"');
    expect(command).toContain('--enableSizeRotation');
    expect(command.split('\n')[1]).toBe('servy-10.1.exe start --name "rustfs-service"');
  });

  it('drops the restart flag when the guard switch is off', () => {
    const command = buildServyPreviewCommand(
      template,
      values,
      { ...basic, restart: false },
    );
    expect(command).not.toContain('--enableSizeRotation');
  });

  it('routes java programs through the configured JVM executable', () => {
    const command = buildServyPreviewCommand(
      SERVICE_TEMPLATES.java,
      {
        jvmPath: 'C:\\jdk\\java.exe',
        xmx: '512m',
        jvmArgs: '',
        appArgs: '--server.port=8080',
      },
      {
        programFile: 'D:\\apps\\order\\order.jar',
        serviceName: 'order-service',
        displayName: 'Order',
        startType: 'Automatic',
        restart: false,
      },
    );
    expect(command).toContain('-p "C:\\jdk\\java.exe"');
    expect(command).toContain('-Xmx512m -jar "D:\\apps\\order\\order.jar"');
  });
});


describe('duplicate managed-service guard', () => {
  const modalSource = readFileSync(
    new URL('../components/AddServiceModal.tsx', import.meta.url),
    'utf8',
  );

  it('blocks the add action when the service name is already managed', () => {
    // 服务名唯一：本地纳管列表命中同名时禁用主按钮并兜底拦截提交。
    expect(modalSource).toContain('managedServices.some(');
    expect(modalSource).toContain('|| alreadyManaged');
    expect(modalSource).toContain('service.modal.managed.exists');
  });
});
