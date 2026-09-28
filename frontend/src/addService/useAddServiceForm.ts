import { useCallback, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/provider';
import { ProbeWindowsService, AddManagedService } from '../../wailsjs/go/app/App';
import type { ServiceProbeResult } from './serviceFieldTypes';
import {
  deriveFieldValue,
  initialValues,
  SERVICE_START_TYPES,
  type ServiceTemplate,
} from './serviceTemplates';

type FieldValues = Record<string, string | boolean>;
type ProbePhase = 'none' | 'probing' | 'ok' | 'exists';
type AddPhase = 'idle' | 'adding' | 'done';

export interface ProbeOutcome {
  phase: ProbePhase;
  exists: boolean;
  state?: string;
  startType?: string;
  fileExists: boolean;
  /** fileExists 为 false 时，第一个不存在的文件路径 */
  missingFile?: string;
  message?: string;
}

export interface BasicInfo {
  programFile: string;
  serviceName: string;
  displayName: string;
  startType: string;
  restart: boolean;
}

const trim = (value: string | boolean | undefined): string => String(value ?? '').trim();

/** servy install 完整命令预览（与后端 buildServyInstallArgs 口径一致，日志目录用占位符）。 */
export function buildServyPreviewCommand(
  template: ServiceTemplate,
  values: FieldValues,
  basic: BasicInfo,
): string {
  const programFile = trim(basic.programFile) || '<程序文件>';
  const exe = trim(template.executable(values)) || programFile;
  const workDir = programFile.replace(/[\\/][^\\/]*$/, '') || '<工作目录>';
  const params = template.params(values, programFile);
  const logDir = '<LOG_DIR>';
  const name = trim(basic.serviceName) || '<服务名>';
  const args = [
    'install',
    '--name', `"${name}"`,
    '-p', `"${exe}"`,
    '--displayName', `"${trim(basic.displayName) || '<显示名称>'}"`,
    '--startupDir', `"${workDir}"`,
    '--startupType', basic.startType,
    '--stdout', `"${logDir}\\service-out.log"`,
    '--stderr', `"${logDir}\\service-err.log"`,
  ];
  if (params) {
    args.push('--params', `"${params}"`);
  }
  if (basic.restart) {
    args.push('--enableSizeRotation');
  }
  const install = ['servy-10.1.exe', ...args].join(' ');
  const start = `servy-10.1.exe start --name "${name}"`;
  return `${install}\n${start}`;
}

/** 添加服务弹框的全部表单状态与动作。 */
export function useAddServiceForm(template: ServiceTemplate) {
  const { t } = useI18n();
  const [values, setValues] = useState<FieldValues>(() => initialValues(template));
  const [basic, setBasic] = useState<BasicInfo>(() => ({
    programFile: template.file,
    serviceName: template.serviceName,
    displayName: t(template.displayNameKey),
    startType: SERVICE_START_TYPES[0],
    restart: true,
  }));
  const [probeOutcome, setProbeOutcome] = useState<ProbeOutcome>({
    phase: 'none',
    exists: false,
    fileExists: false,
  });
  const [addPhase, setAddPhase] = useState<AddPhase>('idle');
  const [addError, setAddError] = useState('');
  /**
   * 被用户手动改过的字段。派生字段（如「数据目录」默认跟随程序文件目录）只在
   * 未被改过时跟随程序文件变化，改过之后就锁住，不再被程序文件覆盖。
   */
  const touchedFieldsRef = useRef<Set<string>>(new Set());

  const applyTemplate = useCallback((next: ServiceTemplate) => {
    touchedFieldsRef.current = new Set();
    setValues(initialValues(next));
    setBasic({
      programFile: next.file,
      serviceName: next.serviceName,
      displayName: t(next.displayNameKey),
      startType: SERVICE_START_TYPES[0],
      restart: true,
    });
    setProbeOutcome({ phase: 'none', exists: false, fileExists: false });
    setAddPhase('idle');
    setAddError('');
  }, []);

  const setFieldValue = useCallback((key: string, value: string | boolean) => {
    touchedFieldsRef.current.add(key);
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setBasicField = useCallback((key: keyof BasicInfo, value: string | boolean) => {
    setBasic((prev) => ({ ...prev, [key]: value }));
    if (key === 'serviceName') {
      setProbeOutcome({ phase: 'none', exists: false, fileExists: false });
    }
    if (key === 'programFile' && typeof value === 'string') {
      setValues((prev) => {
        const next = { ...prev };
        template.fields.forEach((field) => {
          if (!field.deriveFromProgramDir || touchedFieldsRef.current.has(field.key)) {
            return;
          }
          const derived = deriveFieldValue(field, value);
          if (derived !== undefined) {
            next[field.key] = derived;
          }
        });
        return next;
      });
    }
  }, [template]);

  const probeNow = useCallback(async (): Promise<ProbeOutcome> => {
    setProbeOutcome((prev) => ({ ...prev, phase: 'probing' }));
    const files = collectProbeProgramFiles(template, values, basic);
    try {
      const result = await ProbeWindowsService(trim(basic.serviceName), files[0] ?? '');
      const data = (result.data ?? {}) as Partial<ServiceProbeResult>;
      let fileExists = data.fileExists !== false;
      let missingFile = fileExists ? undefined : files[0] ?? '';
      // Java 会涉及 JVM 路径与程序文件两个路径，逐个补查存在性，任何一个缺失都算不过。
      for (const extra of files.slice(1)) {
        const extraResult = await ProbeWindowsService(trim(basic.serviceName), extra);
        const extraData = (extraResult.data ?? {}) as Partial<ServiceProbeResult>;
        const extraExists = extraData.fileExists !== false;
        if (!extraExists && !missingFile) {
          missingFile = extra;
        }
        fileExists = fileExists && extraExists;
      }
      const outcome: ProbeOutcome = {
        phase: data.exists ? 'exists' : 'ok',
        exists: Boolean(data.exists),
        state: data.state,
        startType: data.startType,
        fileExists,
        missingFile,
      };
      setProbeOutcome(outcome);
      return outcome;
    } catch (error) {
      // 后端不可达（如非 Windows 构建）时不阻塞流程，仅记录信息。
      const outcome: ProbeOutcome = {
        phase: 'ok',
        exists: false,
        fileExists: true,
        message: error instanceof Error ? error.message : String(error),
      };
      setProbeOutcome(outcome);
      return outcome;
    }
  }, [basic, template, values]);

  const addToManaged = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
    mode: 'register' | 'manage';
  }> => {
    let outcome = probeOutcome;
    if (outcome.phase === 'none' || outcome.phase === 'probing') {
      outcome = await probeNow();
    }
    setAddPhase('adding');
    setAddError('');
    const mode: 'register' | 'manage' = outcome.exists ? 'manage' : 'register';
    try {
      if (mode === 'register') {
        const result = await AddManagedService({
          mode,
          serviceType: template.id,
          name: trim(basic.serviceName),
          displayName: trim(basic.displayName) || trim(basic.serviceName),
          description: '',
          programFile: resolveProgramFile(template, values, basic),
          params: template.params(values, trim(basic.programFile)),
          workDir: trim(basic.programFile).replace(/[\\/][^\\/]*$/, ''),
          startType: basic.startType,
          restart: basic.restart,
          confName: template.conf?.name ?? '',
          confContent: template.conf ? template.conf.render(values, trim(basic.programFile)) : '',
        });
        if (!result.success) {
          setAddPhase('idle');
          setAddError(result.message);
          return { ok: false, message: result.message, mode };
        }
      }
      setAddPhase('done');
      return { ok: true, message: '', mode };
    } catch (error) {
      setAddPhase('idle');
      const message = error instanceof Error ? error.message : String(error);
      setAddError(message);
      return { ok: false, message, mode };
    }
  }, [basic, probeNow, probeOutcome, template, values]);

  const previewCommand = useMemo(
    () => buildServyPreviewCommand(template, values, basic),
    [template, values, basic],
  );

  const resetAll = useCallback(() => {
    applyTemplate(template);
  }, [applyTemplate, template]);

  return {
    values,
    basic,
    probe: probeOutcome,
    addPhase,
    addError,
    previewCommand,
    setFieldValue,
    setBasicField,
    applyTemplate,
    probeNow,
    addToManaged,
    resetAll,
  };
}

/** Java 模板的 -p 是 JVM 路径；其余类型是程序文件本身。 */
function resolveProgramFile(
  template: ServiceTemplate,
  values: FieldValues,
  basic: BasicInfo,
): string {
  if (template.id === 'java') {
    const jvmPath = trim(values.jvmPath);
    return jvmPath || trim(basic.programFile);
  }
  return trim(basic.programFile);
}

/**
 * 探测要校验存在的文件清单：Java 是 -p 用的 JVM 路径 + 用户填的程序文件（jar/war），
 * 其余类型只有程序文件本身；去重、去空。
 */
export function collectProbeProgramFiles(
  template: ServiceTemplate,
  values: FieldValues,
  basic: BasicInfo,
): string[] {
  const primary = resolveProgramFile(template, values, basic);
  const files = template.id === 'java' ? [primary, trim(basic.programFile)] : [primary];
  return [...new Set(files.filter((file) => file !== ''))];
}
