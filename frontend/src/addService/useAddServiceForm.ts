import { useCallback, useRef, useState } from 'react';
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
type ProbePhase = 'none' | 'probing' | 'ok' | 'exists' | 'error';
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
  /** 服务描述，非必填；注册时写进 SCM description（servy --description）。 */
  description: string;
  startType: string;
  restart: boolean;
  /** 日志按大小轮转（servy --enableSizeRotation）。 */
  rotate: boolean;
}

const trim = (value: string | boolean | undefined): string => String(value ?? '').trim();

/** 添加服务弹框的全部表单状态与动作。 */
export function useAddServiceForm(template: ServiceTemplate) {
  const { t } = useI18n();
  const [values, setValues] = useState<FieldValues>(() => initialValues(template));
  /* 三个基本输入框（程序文件 / 服务名 / 显示名称）一律空值起步，由用户自己填写；
     参数配置页仍保留模板默认参数（JVM 路径、堆内存等），那是「已知服务模板」的价值所在。 */
  const [basic, setBasic] = useState<BasicInfo>(() => ({
    programFile: '',
    serviceName: '',
    displayName: '',
    description: '',
    startType: SERVICE_START_TYPES[0],
    restart: true,
    rotate: true,
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
      programFile: '',
      serviceName: '',
      displayName: '',
      description: '',
      startType: SERVICE_START_TYPES[0],
      restart: true,
      rotate: true,
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
    /* Windows 服务名惯例全大写：用户手输的小写自动转成大写（模板预填值不动）。 */
    const normalized = key === 'serviceName' && typeof value === 'string' ? value.toUpperCase() : value;
    setBasic((prev) => ({ ...prev, [key]: normalized }));
    if (key === 'serviceName' || key === 'programFile' || key === 'displayName') {
      /* 这三个字段参与探测校验，改动后上次探测结果即过期，回到「未探测」。 */
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

  /* 探测/提交按序校验（口径一致）：
     ① 程序文件为空 → ② 程序文件存在（后端文件校验，先于服务名）→
     ③ 服务名为空 → ④ 服务名重复（SCM 已存在走纳管分支 / 已在纳管列表由弹窗拦截）→
     ⑤ 显示名称为空。哪一步在前先报哪一步。 */
  const probeNow = useCallback(async (): Promise<ProbeOutcome> => {
    const fail = (message: string): ProbeOutcome => {
      const outcome: ProbeOutcome = {
        phase: 'error',
        exists: false,
        fileExists: true,
        message,
      };
      setProbeOutcome(outcome);
      return outcome;
    };
    if (trim(basic.programFile) === '') {
      return fail(t('service.modal.probe.programRequired'));
    }
    setProbeOutcome((prev) => ({ ...prev, phase: 'probing' }));
    const files = collectProbeProgramFiles(template, values, basic);
    try {
      const result = await ProbeWindowsService(trim(basic.serviceName), files[0] ?? '');
      /* 后端拒绝（如 SCM 异常）必须当作探测失败展示，不能把空 Data 当「通过」。 */
      if (!result.success) {
        return fail(result.message || t('service.modal.probe.failed'));
      }
      const data = (result.data ?? {}) as Partial<ServiceProbeResult>;
      if (data.fileExists === false) {
        const missing: ProbeOutcome = {
          phase: 'ok',
          exists: false,
          fileExists: false,
          missingFile: files[0] ?? '',
        };
        setProbeOutcome(missing);
        return missing;
      }
      if (trim(basic.serviceName) === '') {
        return fail(t('service.modal.probe.nameRequired'));
      }
      if (trim(basic.displayName) === '') {
        return fail(t('service.modal.probe.displayNameRequired'));
      }
      // Java 会涉及 JVM 路径与程序文件两个路径，逐个补查存在性，任何一个缺失都算不过。
      let fileExists = true;
      let missingFile: string | undefined;
      for (const extra of files.slice(1)) {
        const extraResult = await ProbeWindowsService(trim(basic.serviceName), extra);
        const extraData = (extraResult.data ?? {}) as Partial<ServiceProbeResult>;
        const extraExists = extraResult.success !== false && extraData.fileExists !== false;
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
    /* 兜底校验：按钮禁用态被绕过（回车提交等）时同样拦住，口径与 probeNow 一致。 */
    if (trim(basic.programFile) === '') {
      const programMessage = t('service.modal.probe.programRequired');
      setAddError(programMessage);
      return { ok: false, message: programMessage, mode: 'register' };
    }
    let outcome = probeOutcome;
    if (outcome.phase === 'none' || outcome.phase === 'probing') {
      outcome = await probeNow();
    }
    /* 探测失败（服务名被拒 / 程序文件缺失）不允许继续注册。 */
    if (outcome.phase === 'error' || !outcome.fileExists) {
      const probeMessage = outcome.message || t('service.modal.probe.failed');
      setAddError(probeMessage);
      return { ok: false, message: probeMessage, mode: 'register' };
    }
    /* 显示名称可能在探测通过后又被清空，提交前按序复验。 */
    if (trim(basic.displayName) === '') {
      const displayMessage = t('service.modal.probe.displayNameRequired');
      setAddError(displayMessage);
      return { ok: false, message: displayMessage, mode: 'register' };
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
          displayName: trim(basic.displayName),
          description: trim(basic.description),
          programFile: resolveProgramFile(template, values, basic),
          params: template.params(values, trim(basic.programFile)),
          workDir: trim(basic.programFile).replace(/[\\/][^\\/]*$/, ''),
          startType: basic.startType,
          restart: basic.restart,
          rotate: basic.rotate,
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

  const resetAll = useCallback(() => {
    applyTemplate(template);
  }, [applyTemplate, template]);

  return {
    values,
    basic,
    probe: probeOutcome,
    addPhase,
    addError,
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
