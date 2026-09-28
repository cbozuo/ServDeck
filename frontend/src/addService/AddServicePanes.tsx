import React, { useEffect, useMemo, useRef, useState } from 'react';
import { message, Tooltip } from 'antd';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  FolderOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useI18n } from '../i18n/provider';
import {
  SERVICE_START_TYPES,
  type ServiceTemplate,
} from './serviceTemplates';
import type { ServiceFieldType, ServiceFieldValues } from './serviceFieldTypes';
import { SelectImageFile, SelectServiceProgramFile, DetectJavaRuntimes } from '../../wailsjs/go/app/App';
import { SegmentedControl } from './SegmentedControl';
import { HeapMemoryField } from './HeapMemoryField';
import { JdkPickerModal } from './JdkPickerModal';
import { APP_NESTED_MODAL_Z_INDEX } from '../utils/overlayZIndex';
import { normalizeIconDataUrl } from './customIcon';

/** 程序文件（servy install 的 -p 来源）；位于基本 tab 顶部，空值起步由用户填写。 */
export const AddServiceProgramSection: React.FC<{
  template: ServiceTemplate;
  programFile: string;
  onChange: (value: string) => void;
}> = ({ template, programFile, onChange }) => {
  const { t } = useI18n();
  const [browsing, setBrowsing] = useState(false);

  const browse = async () => {
    if (browsing) {
      return;
    }
    setBrowsing(true);
    try {
      const result = await SelectServiceProgramFile(template.id);
      if (result.success && typeof result.data?.path === 'string' && result.data.path !== '') {
        onChange(result.data.path);
      }
    } catch {
      // 运行时不可用（如纯浏览器预览）时静默忽略。
    } finally {
      setBrowsing(false);
    }
  };

  return (
    <div className="asm-sec">
      <div className="asm-sec-title">{t('service.modal.program.heading')}</div>
      <div className="asm-input-row">
        <Tooltip title={t(template.fileHintKey)} placement="top" overlayStyle={{ maxWidth: 560 }}>
          <div className="asm-input asm-input-with-icon" style={{ flex: 1 }}>
            <FolderOutlined className="asm-input-lead-ic" />
            <input
              className="mono"
              value={programFile}
              placeholder={t(template.fileHintKey)}
              spellCheck={false}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        </Tooltip>
        <button type="button" className="asm-browse-btn" disabled={browsing} onClick={() => void browse()}>
          {t('service.modal.program.browse')}
        </button>
      </div>
    </div>
  );
};

/** 根据程序文件名生成服务名：取文件名去扩展名，非法字符折叠为「-」；大写转换由输入侧统一处理。 */
export function serviceNameFromFile(programFile: string): string {
  const base = String(programFile ?? '')
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '');
  return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

const fieldTooltip = (text: string) => ({
  title: text,
  placement: 'top' as const,
  // 弹框内容区约 680px，提示框限宽保证永不超出弹框；长文案换行展示
  overlayStyle: { maxWidth: 560 },
  overlayInnerStyle: { whiteSpace: 'normal' as const },
});

/** 高保真同款 Java 杯图标（「选择 JDK」入口按钮）。 */
const JavaCupIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width={13} height={13} fill="none" aria-hidden="true">
    <path
      d="M4 6.9h7v3.4a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M11 7.5h.8a1.7 1.7 0 0 1 0 3.4h-.9"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <path
      d="M6.4 3.2c-.5.8.5 1.1 0 2M9.1 3.2c-.5.8.5 1.1 0 2"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
  </svg>
);

/** 服务名 + 显示名称 + 服务描述（描述非必填），各占一行；悬浮输入框出美化提示框。 */
export const AddServiceBasicSection: React.FC<{
  programFile: string;
  serviceName: string;
  displayName: string;
  description: string;
  onNameChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}> = ({ programFile, serviceName, displayName, description, onNameChange, onDisplayNameChange, onDescriptionChange }) => {
  const { t } = useI18n();
  const namePlaceholder = t('service.modal.basic.serviceNamePlaceholder');
  const generatedName = serviceNameFromFile(programFile);
  return (
    <div className="asm-sec">
      <div className="asm-sec-title">{t('service.modal.basic.identity')}</div>
      {/* 服务名 / 显示名称 / 服务描述各占一行：placeholder 提示较长，整行才放得下 */}
      <div className="asm-field-grid">
        <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
          <label>
            {t('service.modal.basic.serviceName')}
            <em>*</em>
          </label>
          <div className="asm-input-row">
            <Tooltip {...fieldTooltip(namePlaceholder)}>
              <input
                className="asm-input"
                style={{ flex: 1 }}
                value={serviceName}
                placeholder={namePlaceholder}
                spellCheck={false}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </Tooltip>
            <Tooltip title={t('service.modal.basic.genName')} placement="top">
              <button
                type="button"
                className="asm-browse-btn"
                disabled={!generatedName}
                onClick={() => onNameChange(generatedName)}
              >
                <ThunderboltOutlined />
                {t('service.modal.basic.genNameShort')}
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
          <label>
            {t('service.modal.basic.displayName')}
            <em>*</em>
          </label>
          <Tooltip {...fieldTooltip(t('service.modal.basic.displayNamePlaceholder'))}>
            <input
              className="asm-input"
              value={displayName}
              placeholder={t('service.modal.basic.displayNamePlaceholder')}
              spellCheck={false}
              onChange={(event) => onDisplayNameChange(event.target.value)}
            />
          </Tooltip>
        </div>
        <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
          <label>{t('service.modal.basic.desc')}</label>
          <Tooltip {...fieldTooltip(t('service.modal.basic.descPlaceholder'))}>
            <input
              className="asm-input"
              value={description}
              placeholder={t('service.modal.basic.descPlaceholder')}
              spellCheck={false}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

/** 启动与守护（高级 tab）：启动类型 + 崩溃重启 / 轮转双开关，对齐高保真「守护与轮转」。 */
export const AddServiceStartSection: React.FC<{
  startType: string;
  restart: boolean;
  rotate: boolean;
  onStartTypeChange: (value: string) => void;
  onRestartChange: (value: boolean) => void;
  onRotateChange: (value: boolean) => void;
}> = ({ startType, restart, rotate, onStartTypeChange, onRestartChange, onRotateChange }) => {
  const { t } = useI18n();
  const startTypeLabel = (value: string): string => {
    if (value === 'Automatic (Delayed)') {
      return t('service.modal.startType.autoDelayed');
    }
    if (value === 'Automatic') {
      return t('service.modal.startType.automatic');
    }
    return t(`service.modal.startType.${value.toLowerCase()}`);
  };
  return (
    <div className="asm-sec">
      <div className="asm-sec-title">{t('service.modal.start.heading')}</div>
      <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
        <label>{t('service.modal.basic.startType')}</label>
        <SegmentedControl
          accent
          options={SERVICE_START_TYPES.map((value) => ({ value, label: startTypeLabel(value) }))}
          value={startType}
          onChange={onStartTypeChange}
          ariaLabel={t('service.modal.basic.startType')}
        />
      </div>
      <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
        <label>{t('service.modal.basic.guardRotate')}</label>
        <div className="asm-switch-line">
          <span
            className={restart ? 'asm-switch on' : 'asm-switch'}
            role="switch"
            aria-checked={restart}
            aria-label={t('service.modal.basic.guard')}
            onClick={() => onRestartChange(!restart)}
          />
          <span className="asm-switch-name">
            {t('service.modal.basic.guard')}
            <small>{t('service.modal.basic.guardHint')}</small>
          </span>
          <span
            className={rotate ? 'asm-switch on' : 'asm-switch'}
            role="switch"
            aria-checked={rotate}
            aria-label={t('service.modal.basic.rotate')}
            style={{ marginLeft: 22 }}
            onClick={() => onRotateChange(!rotate)}
          />
          <span className="asm-switch-name">
            {t('service.modal.basic.rotate')}
            <small className="mono">{t('service.modal.basic.rotateHint')}</small>
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * 目录字段：可手输路径，也可点「浏览…」打开系统目录选择框。
 * 返回值由上层提供（调用 SelectDirectory 绑定），未接线时按钮禁用，输入框照常可用。
 */
const DirectoryField: React.FC<{
  title: string;
  value: string;
  placeholder?: string;
  browseLabel: string;
  onValueChange: (value: string) => void;
  onPick?: (title: string, current: string) => Promise<string | null>;
}> = ({ title, value, placeholder, browseLabel, onValueChange, onPick }) => {
  const [picking, setPicking] = useState(false);
  const browse = async () => {
    if (!onPick || picking) {
      return;
    }
    setPicking(true);
    try {
      const picked = await onPick(title, value);
      if (picked) {
        onValueChange(picked);
      }
    } finally {
      setPicking(false);
    }
  };
  return (
    <div className="asm-input-row">
      <input
        className="asm-input mono"
        value={value}
        placeholder={placeholder ?? ''}
        spellCheck={false}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <button
        type="button"
        className="asm-browse-btn"
        disabled={picking || !onPick}
        onClick={() => void browse()}
      >
        {browseLabel}
      </button>
    </div>
  );
};

/**
 * 密码字段：右侧内嵌一枚眼睛按钮切换明文。
 *
 * 默认保持密文（配置里的口令常常要截图或提工单，误泄露代价高于少点一次的便利），
 * 按钮用 aria-pressed 暴露当前状态，键盘可达。输入框始终保留本组件的受控值，
 * 切换只改 type，不触发 onChange。
 */
const PasswordField: React.FC<{
  value: string;
  placeholder?: string;
  showLabel: string;
  hideLabel: string;
  onChange: (value: string) => void;
}> = ({ value, placeholder, showLabel, hideLabel, onChange }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="asm-password-field">
      <input
        className="asm-input mono asm-password-input"
        type={visible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder ?? ''}
        spellCheck={false}
        autoComplete="new-password"
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="asm-password-toggle"
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        onClick={() => setVisible((prev) => !prev)}
      >
        {visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
      </button>
    </div>
  );
};

/**
 * 短值字段不必撑满整列。
 * 端口是 4 位数字，下拉最长也就 7 个字符，撑满一列会在右侧留下大片空白。
 * 目录、密钥、口令这类长度不可控的字段保持 100%。
 */
const inputWidthClass = (type: ServiceFieldType): string => {
  if (type === 'port') {
    return ' asm-input-narrow';
  }
  if (type === 'select') {
    return ' asm-input-medium';
  }
  return '';
};

/**
 * 高保真「常用参数」开关：点击追加 / 移除 jvmArgs 里的布尔类参数。
 * 与服务详情页部署参数的开关组同一套（flags 也一致）。
 */
const JAVA_FLAG_PRESETS = [
  { labelKey: 'service.preset.oomDump', flag: '-XX:+HeapDumpOnOutOfMemoryError', hintKey: 'service.preset.oomDump.hint' },
  { labelKey: 'service.preset.g1', flag: '-XX:+UseG1GC', hintKey: 'service.preset.g1.hint' },
  { labelKey: 'service.preset.zgc', flag: '-XX:+UseZGC', hintKey: 'service.preset.zgc.hint' },
  { labelKey: 'service.preset.utf8', flag: '-Dfile.encoding=UTF-8', hintKey: 'service.preset.utf8.hint' },
  { labelKey: 'service.preset.tz', flag: '-Duser.timezone=Asia/Shanghai', hintKey: 'service.preset.tz.hint' },
  {
    labelKey: 'service.preset.debug',
    flag: '-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005',
    hintKey: 'service.preset.debug.hint',
  },
] as const;

/** 参数配置 tab：Java 对齐高保真（全宽行 + 常用参数组），其余类型走模板字段栅格 + 配置文件生成卡。 */
export const AddServiceParamsPane: React.FC<{
  template: ServiceTemplate;
  values: ServiceFieldValues;
  onChange: (key: string, value: string | boolean) => void;
  onPickDirectory?: (title: string, current: string) => Promise<string | null>;
  /** 宿主弹窗的 zIndex；JDK 选择等嵌套弹层在其上叠放。 */
  nestedZIndex?: number;
}> = ({ template, values, onChange, onPickDirectory, nestedZIndex }) => {
  const { t } = useI18n();
  const [confMode, setConfMode] = useState<'preview' | 'raw'>('preview');
  const [jdkOpen, setJdkOpen] = useState(false);
  /** JVM 路径超长提示：仅当路径文本超出输入框宽度时出现，内容是完整路径。
      用原生 mouseenter/mouseleave（非 React 合成事件），悬停即时计算溢出。 */
  const [jdkTipOpen, setJdkTipOpen] = useState(false);
  const jdkPathInputRef = useRef<HTMLInputElement>(null);
  /** JVM 参数输入框：调堆内存 / 点开关后保持聚焦，让改动落在看得见的地方。 */
  const jvmArgsInputRef = useRef<HTMLInputElement>(null);
  /** JVM 路径默认值：本机检测到的最低版本 JDK（仅当用户没改过模板默认值时自动替换一次）。 */
  const jdkDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (template.id !== 'java' || jdkDefaultAppliedRef.current) {
      return;
    }
    const templateDefault = template.fields.find((item) => item.key === 'jvmPath')?.value ?? '';
    if (String(values.jvmPath ?? '') !== templateDefault) {
      // 用户已经填了自己的路径，不再动它
      jdkDefaultAppliedRef.current = true;
      return;
    }
    let alive = true;
    DetectJavaRuntimes()
      .then((result) => {
        if (!alive || jdkDefaultAppliedRef.current || !result.success) {
          return;
        }
        const list =
          (result.data as { candidates?: { version: number; path: string }[] } | null | undefined)
            ?.candidates ?? [];
        const lowest = list.reduce<{ version: number; path: string } | null>(
          (min, item) => (min === null || item.version < min.version ? item : min),
          null,
        );
        if (lowest) {
          jdkDefaultAppliedRef.current = true;
          onChange('jvmPath', lowest.path);
        }
      })
      .catch(() => {
        // 检测不可用时保留模板默认路径。
      });
    return () => {
      alive = false;
    };
    // 仅在进入参数配置时执行一次（values.jvmPath 故意不进依赖）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);
  useEffect(() => {
    const el = jdkPathInputRef.current;
    if (!el) {
      return;
    }
    const show = () => setJdkTipOpen(el.scrollWidth > el.clientWidth + 1);
    const hide = () => setJdkTipOpen(false);
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    return () => {
      el.removeEventListener('mouseenter', show);
      el.removeEventListener('mouseleave', hide);
    };
  }, []);

  const confContent = useMemo(() => {
    if (!template.conf) {
      return '';
    }
    return template.conf.render(values, template.file);
  }, [template, values]);

  const renderFieldControl = (field: (typeof template.fields)[number]) => {
    if (field.type === 'switch') {
      return (
        <span
          className={values[field.key] ? 'asm-switch on' : 'asm-switch'}
          role="switch"
          aria-checked={Boolean(values[field.key])}
          aria-label={t(field.labelKey)}
          onClick={() => onChange(field.key, !values[field.key])}
        />
      );
    }
    if (field.type === 'directory') {
      return (
        <DirectoryField
          title={t(field.labelKey)}
          value={String(values[field.key] ?? '')}
          placeholder={field.placeholder}
          browseLabel={t('service.modal.program.browse')}
          onValueChange={(value) => onChange(field.key, value)}
          onPick={onPickDirectory}
        />
      );
    }
    if (field.type === 'select') {
      return (
        <select
          className={`asm-input asm-select${inputWidthClass(field.type)}`}
          value={String(values[field.key] ?? '')}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'password') {
      return (
        <PasswordField
          value={String(values[field.key] ?? '')}
          placeholder={field.placeholder}
          showLabel={t('service.modal.password.show')}
          hideLabel={t('service.modal.password.hide')}
          onChange={(value) => onChange(field.key, value)}
        />
      );
    }
    return (
      <input
        className={`asm-input${inputWidthClass(field.type)}`}
        type="text"
        value={String(values[field.key] ?? '')}
        placeholder={field.placeholder ?? ''}
        spellCheck={false}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  };

  /* 全宽行 + label 内联提示（对齐高保真：JVM 路径 / JVM 参数都是整行），
     控件悬浮出与基本信息同款的提示框 */
  const fieldRow = (key: string, hintKey?: string) => {
    const field = template.fields.find((item) => item.key === key);
    if (!field) {
      return null;
    }
    return (
      <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
        <label>
          {t(field.labelKey)}
          {hintKey ? <span className="asm-label-hint">{t(hintKey)}</span> : null}
        </label>
        {hintKey ? (
          <Tooltip {...fieldTooltip(t(hintKey))}>{renderFieldControl(field)}</Tooltip>
        ) : (
          renderFieldControl(field)
        )}
      </div>
    );
  };

  let fieldsPart: React.ReactNode;
  if (template.id === 'java') {
    /* Java 对齐服务详情页高保真：JVM 路径（内嵌「选择 JDK」）+ JVM 参数（堆内存滑杆
       直接把 -Xms/-Xmx 写进参数串最前，输入框实时可见），程序启动参数由应用自身
       配置文件承载，不再单列。调堆内存 / 点开关后 JVM 参数输入框回到聚焦态，
       提示用户改动都体现在这串参数里。 */
    const jvmArgs = String(values.jvmArgs ?? '');
    const jvmPathField = template.fields.find((item) => item.key === 'jvmPath');
    const jvmArgsField = template.fields.find((item) => item.key === 'jvmArgs');
    if (!jvmPathField || !jvmArgsField) {
      fieldsPart = null;
    } else {
      const focusJvmArgs = () => {
        const el = jvmArgsInputRef.current;
        if (!el) {
          return;
        }
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      };
      fieldsPart = (
        <React.Fragment>
          <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
            <label>
              {t(jvmPathField.labelKey)}
              <span className="asm-label-hint">{t('service.field.jvmPathHint')}</span>
            </label>
            {/* 悬浮提示只在路径超出输入框宽度时出现，内容是完整路径 */}
            <Tooltip
              title={String(values.jvmPath ?? '')}
              open={jdkTipOpen}
              placement="top"
              overlayStyle={{ maxWidth: 560 }}
            >
              <div className="asm-input asm-input-with-icon" style={{ width: '100%' }}>
                <input
                  ref={jdkPathInputRef}
                  className="mono"
                  style={{ flex: 1 }}
                  value={String(values.jvmPath ?? '')}
                  spellCheck={false}
                  onChange={(event) => onChange('jvmPath', event.target.value)}
                />
                <Tooltip title={t('service.modal.jdk.pick')} placement="top">
                  <button type="button" className="asm-in-act" onClick={() => setJdkOpen(true)}>
                    <JavaCupIcon />
                  </button>
                </Tooltip>
              </div>
            </Tooltip>
          </div>
          <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
            <label>{t(jvmArgsField.labelKey)}</label>
            <input
              ref={jvmArgsInputRef}
              className="asm-input mono"
              style={{ width: '100%' }}
              type="text"
              value={jvmArgs}
              placeholder={jvmArgsField.placeholder ?? ''}
              spellCheck={false}
              onChange={(event) => onChange('jvmArgs', event.target.value)}
            />
          </div>
          <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
            <label>
              {t('service.field.presets')}
              <span className="asm-label-hint">{t('service.field.presetsHint')}</span>
            </label>
            <div className="asm-preset-row">
              <span className="asm-preset-label">{t('service.field.heapShort')}</span>
              <HeapMemoryField
                jvmArgs={jvmArgs}
                onChange={(value) => {
                  onChange('jvmArgs', value);
                  focusJvmArgs();
                }}
              />
            </div>
            <div className="asm-preset-row">
              <span className="asm-preset-label">{t('service.field.flagsLabel')}</span>
              <div className="asm-chips">
                {JAVA_FLAG_PRESETS.map((preset) => {
                  const on = jvmArgs.includes(preset.flag);
                  return (
                    <button
                      key={preset.flag}
                      type="button"
                      className={on ? 'asm-chip on' : 'asm-chip'}
                      title={`${preset.flag} · ${t(preset.hintKey)}`}
                      onClick={() => {
                        const args = jvmArgs.split(/\s+/).filter(Boolean);
                        const next = args.includes(preset.flag)
                          ? args.filter((arg) => arg !== preset.flag)
                          : [...args, preset.flag];
                        onChange('jvmArgs', next.join(' '));
                        focusJvmArgs();
                      }}
                    >
                      {t(preset.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <JdkPickerModal
            open={jdkOpen}
            currentPath={String(values.jvmPath ?? '')}
            zIndex={(nestedZIndex ?? APP_NESTED_MODAL_Z_INDEX) + 10}
            onClose={() => setJdkOpen(false)}
            onApply={(path) => {
              onChange('jvmPath', path);
              setJdkOpen(false);
            }}
          />
        </React.Fragment>
      );
    }
  } else {
    fieldsPart = (
      <div className={`asm-field-grid${template.fields.length > 3 ? ' cols-3' : ''}`}>
        {template.fields.map((field) => (
          <div
            key={field.key}
            className="asm-field"
            style={field.span === 2 ? { gridColumn: '1 / -1' } : undefined}
          >
            <label>{t(field.labelKey)}</label>
            {renderFieldControl(field)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="asm-sec">
      <div className="asm-sec-title">{t(template.sectionKey)}</div>
      {fieldsPart}

      {template.conf ? (
        <div className="asm-conf-card">
          <div className="asm-conf-head">
            <span className="asm-conf-name mono">{template.conf.name}</span>
            <span className="asm-conf-badge">{t('service.modal.conf.autoGen')}</span>
            <SegmentedControl
              size="sm"
              options={[
                { value: 'preview', label: t('service.modal.conf.byFields') },
                { value: 'raw', label: t('service.modal.conf.advancedEdit') },
              ]}
              value={confMode}
              onChange={setConfMode}
              ariaLabel={t('service.modal.conf.autoGen')}
            />
            <a
              className="asm-conf-doc"
              href={template.conf.docUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t('service.modal.conf.doc')}
            </a>
          </div>
          <div className="asm-conf-body">
            {confMode === 'preview' ? (
              <pre className="asm-conf-gen mono">{confContent}</pre>
            ) : (
              <textarea className="mono" defaultValue={confContent} spellCheck={false} />
            )}
            <div className="asm-hint">{t(template.conf.hintKey)}</div>
          </div>
        </div>
      ) : (
        <div className="asm-hint">{t('service.modal.conf.none')}</div>
      )}
      <div className="asm-global-note">{t('service.modal.globalNote')}</div>
    </div>
  );
};

const DEFAULT_LOOK_COLOR = '#c2410c';
const LOOK_COLORS = [
  '#0d7cad', '#155e75', '#dc2626', '#15803d', '#2f8f4e', '#c2410c', '#d97706',
  '#0ea5e9', '#2563eb', '#7c3aed', '#db2777', '#64748b', '#0f766e', '#e11d48', '#65a30d',
];

/**
 * 某个服务类型可选的额外图标变体（同一服务的其它画法，不是别的服务）。
 *
 * 表现在是空的：还没有这类素材。往对应类型下面添一项，它就会自动出现在「自定义」
 * 候选里，不需要改渲染逻辑。这就是这个表存在的全部意义。
 *
 * 历史包袱：这里曾经列过 mysql / java / redis / nginx 四枚图标。那是别的服务类型的
 * 图标，对正在配置的服务来说是错误选项，已移除。
 */
const LOOK_EXTRA_ICONS: Partial<Record<string, string[]>> = {};

/** 外观选择（图标 + 主色）。提到弹窗层持有，添加服务时一并写进纳管记录。 */
export interface ServiceLook {
  mode: 'type' | 'custom';
  color: string;
  /** 自定义图标源。可以是上传的 data URL，也可以是变体路径；为空表示沿用类型图标。 */
  customIcon?: string;
}

export const DEFAULT_SERVICE_LOOK: ServiceLook = {
  mode: 'type',
  color: DEFAULT_LOOK_COLOR,
};

/**
 * 外观 tab：类型图标 / 自定义 子 tab + 颜色行 + 预览卡（重置为默认）。
 *
 * 「自定义」的候选只放同一服务的图标：当前类型图标加该类型的变体，再加一个上传入口。
 * 用户也可以直接跳过候选，上传自己的图片。
 */
export const AddServiceLookPane: React.FC<{
  template: ServiceTemplate;
  value: ServiceLook;
  onChange: (next: ServiceLook) => void;
}> = ({ template, value, onChange }) => {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);

  const custom = value.mode === 'custom';
  const candidates = [template.iconSrc, ...(LOOK_EXTRA_ICONS[template.id] ?? [])];
  const activeIcon = custom && value.customIcon ? value.customIcon : template.iconSrc;

  const upload = async () => {
    if (uploading) {
      return;
    }
    setUploading(true);
    try {
      const result = await SelectImageFile(t('service.modal.look.upload'));
      if (!result.success) {
        if (result.message) {
          void message.error(result.message);
        }
        return;
      }
      const payload = result.data as { dataUrl?: string } | null | undefined;
      const picked = typeof payload?.dataUrl === 'string' ? payload.dataUrl : '';
      if (!picked) {
        // 用户取消，保持原样
        return;
      }
      // 缩到 128px 再存：纳管记录是本地持久化的，原图会很快顶到配额。
      onChange({ ...value, mode: 'custom', customIcon: await normalizeIconDataUrl(picked) });
    } catch (error) {
      void message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="asm-sec">
      <div className="asm-look-head">
        <span className="asm-look-label">
          {t('service.modal.look.icon')}
          <span className="asm-look-cur">{t('service.modal.look.currentType')}</span>
        </span>
        <SegmentedControl
          size="sm"
          options={[
            { value: 'type', label: t('service.modal.look.typeIcon') },
            { value: 'custom', label: t('service.modal.look.custom') },
          ]}
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
          ariaLabel={t('service.modal.look.icon')}
        />
      </div>
      <div className="asm-hint">
        {custom
          ? t('service.modal.look.customHint')
          : t('service.modal.look.typeFixedHint', { type: t(template.labelKey) })}
      </div>

      {custom ? (
        <div className="asm-look-icon-grid">
          {candidates.map((src) => {
            const isTypeIcon = src === template.iconSrc;
            const on = isTypeIcon ? !value.customIcon : value.customIcon === src;
            return (
              <button
                key={src}
                type="button"
                className={on ? 'asm-look-icon-opt on' : 'asm-look-icon-opt'}
                aria-pressed={on}
                onClick={() => onChange({ ...value, customIcon: isTypeIcon ? undefined : src })}
              >
                <img src={src} alt="" />
              </button>
            );
          })}
          {value.customIcon ? (
            <button
              type="button"
              className="asm-look-icon-opt on asm-look-icon-uploaded"
              aria-pressed
              title={t('service.modal.look.upload')}
              onClick={() => onChange({ ...value, customIcon: value.customIcon })}
            >
              <img src={value.customIcon} alt="" />
            </button>
          ) : null}
          <button
            type="button"
            className="asm-look-upload"
            disabled={uploading}
            onClick={() => void upload()}
          >
            <UploadOutlined />
            <span>{t('service.modal.look.upload')}</span>
          </button>
        </div>
      ) : null}

      <div className="asm-look-label" style={{ margin: '2px 0 8px' }}>
        {t('service.modal.look.color')}
      </div>
      <div className="asm-look-dots">
        {LOOK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={value.color === c ? 'asm-look-dot on' : 'asm-look-dot'}
            style={{ background: c }}
            aria-label={c}
            onClick={() => onChange({ ...value, color: c })}
          />
        ))}
      </div>

      <div className="asm-look-preview">
        <span
          className="asm-look-preview-ico"
          style={{
            background: `color-mix(in srgb, ${value.color} 16%, var(--gn-bg-panel))`,
            borderColor: `color-mix(in srgb, ${value.color} 32%, transparent)`,
          }}
        >
          <img src={activeIcon} alt="" />
        </span>
        <span className="asm-look-preview-text">
          <b>{t('service.modal.look.previewName')}</b>
          <small>{t('service.modal.look.previewSub')}</small>
        </span>
        <button
          type="button"
          className="asm-look-reset"
          onClick={() => onChange(DEFAULT_SERVICE_LOOK)}
        >
          {t('service.modal.look.reset')}
        </button>
      </div>
    </div>
  );
};
