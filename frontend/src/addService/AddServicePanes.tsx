import React, { useMemo, useState } from 'react';
import { message } from 'antd';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  FolderOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useI18n } from '../i18n/provider';
import {
  SERVICE_START_TYPES,
  type ServiceTemplate,
} from './serviceTemplates';
import type { ServiceFieldType, ServiceFieldValues } from './serviceFieldTypes';
import { SelectImageFile, SelectServiceProgramFile } from '../../wailsjs/go/app/App';
import { SegmentedControl } from './SegmentedControl';
import { normalizeIconDataUrl } from './customIcon';

/** 程序文件（servy install 的 -p 来源）+ 识别条；位于基本 tab 顶部。 */
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
        <div className="asm-input asm-input-with-icon" style={{ flex: 1 }}>
          <FolderOutlined className="asm-input-lead-ic" />
          <input
            className="mono"
            value={programFile}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <button type="button" className="asm-browse-btn" disabled={browsing} onClick={() => void browse()}>
          {t('service.modal.program.browse')}
        </button>
      </div>
      <div className="asm-hint">{t(template.fileHintKey)}</div>
      <div className="asm-detect">
        <span className="asm-detect-glyph">✦</span>
        <span className="asm-detect-main">
          {t('service.modal.detect.known', { type: t(template.labelKey) })}
        </span>
        <span className="asm-tag asm-tag-hot">{t('service.modal.detect.knownTag')}</span>
      </div>
    </div>
  );
};

/** 服务名 + 显示名称。 */
export const AddServiceBasicSection: React.FC<{
  serviceName: string;
  displayName: string;
  onNameChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
}> = ({ serviceName, displayName, onNameChange, onDisplayNameChange }) => {
  const { t } = useI18n();
  return (
    <div className="asm-sec">
      <div className="asm-sec-title">{t('service.modal.basic.identity')}</div>
      <div className="asm-field-grid">
        <div className="asm-field">
          <label>
            {t('service.modal.basic.serviceName')}
            <em>*</em>
          </label>
          <input
            className="asm-input mono"
            value={serviceName}
            spellCheck={false}
            onChange={(event) => onNameChange(event.target.value)}
          />
          <span className="asm-hint">{t('service.modal.basic.serviceNameHint')}</span>
        </div>
        <div className="asm-field">
          <label>
            {t('service.modal.basic.displayName')}
            <em>*</em>
          </label>
          <input
            className="asm-input"
            value={displayName}
            spellCheck={false}
            onChange={(event) => onDisplayNameChange(event.target.value)}
          />
          <span className="asm-hint">{t('service.modal.basic.displayNameHint')}</span>
        </div>
      </div>
    </div>
  );
};

/** 启动类型 + 崩溃守护。 */
export const AddServiceStartSection: React.FC<{
  startType: string;
  restart: boolean;
  onStartTypeChange: (value: string) => void;
  onRestartChange: (value: boolean) => void;
}> = ({ startType, restart, onStartTypeChange, onRestartChange }) => {
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
      <div className="asm-sec-title">
        {t('service.modal.start.heading')}
        <span className="asm-sec-opt">{t('service.modal.start.common')}</span>
      </div>
      <div className="asm-start-grid">
        <div className="asm-field">
          <label>{t('service.modal.basic.startType')}</label>
          <SegmentedControl
            options={SERVICE_START_TYPES.map((value) => ({ value, label: startTypeLabel(value) }))}
            value={startType}
            onChange={onStartTypeChange}
            ariaLabel={t('service.modal.basic.startType')}
          />
        </div>
        <div className="asm-field asm-switch-field">
          <span
            className={restart ? 'asm-switch on' : 'asm-switch'}
            role="switch"
            aria-checked={restart}
            aria-label={t('service.modal.basic.restart')}
            onClick={() => onRestartChange(!restart)}
          />
          <span>{t('service.modal.basic.restart')}</span>
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

/** 参数配置 tab：模板专属字段 + 配置文件生成卡（按字段生成 / 高级编辑）。 */
export const AddServiceParamsPane: React.FC<{
  template: ServiceTemplate;
  values: ServiceFieldValues;
  onChange: (key: string, value: string | boolean) => void;
  onPickDirectory?: (title: string, current: string) => Promise<string | null>;
}> = ({ template, values, onChange, onPickDirectory }) => {
  const { t } = useI18n();
  const [confMode, setConfMode] = useState<'preview' | 'raw'>('preview');

  const confContent = useMemo(() => {
    if (!template.conf) {
      return '';
    }
    return template.conf.render(values, template.file);
  }, [template, values]);

  return (
    <div className="asm-sec">
      <div className="asm-sec-title">
        {t(template.sectionKey)}
        <span className="asm-sec-badge">{t('service.modal.conf.templateOnly')}</span>
      </div>
      <div className={`asm-field-grid${template.fields.length > 3 ? ' cols-3' : ''}`}>
        {template.fields.map((field) => (
          <div
            key={field.key}
            className="asm-field"
            style={field.span === 2 ? { gridColumn: '1 / -1' } : undefined}
          >
            <label>{t(field.labelKey)}</label>
            {field.type === 'switch' ? (
              <span
                className={values[field.key] ? 'asm-switch on' : 'asm-switch'}
                role="switch"
                aria-checked={Boolean(values[field.key])}
                aria-label={t(field.labelKey)}
                onClick={() => onChange(field.key, !values[field.key])}
              />
            ) : field.type === 'directory' ? (
              <DirectoryField
                title={t(field.labelKey)}
                value={String(values[field.key] ?? '')}
                placeholder={field.placeholder}
                browseLabel={t('service.modal.program.browse')}
                onValueChange={(value) => onChange(field.key, value)}
                onPick={onPickDirectory}
              />
            ) : field.type === 'select' ? (
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
            ) : field.type === 'password' ? (
              <PasswordField
                value={String(values[field.key] ?? '')}
                placeholder={field.placeholder}
                showLabel={t('service.modal.password.show')}
                hideLabel={t('service.modal.password.hide')}
                onChange={(value) => onChange(field.key, value)}
              />
            ) : (
              <input
                className={`asm-input${inputWidthClass(field.type)}`}
                type="text"
                value={String(values[field.key] ?? '')}
                placeholder={field.placeholder ?? ''}
                spellCheck={false}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </div>
        ))}
      </div>

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

/** 高级 tab（对齐高保真）：运行身份 / 进程优先级 / 环境变量。 */
export const AddServiceAdvancedPane: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="asm-sec">
      <div className="asm-field-grid">
        <div className="asm-field">
          <label>{t('service.modal.advanced.account')}</label>
          <select className="asm-input asm-select" defaultValue="LocalSystem">
            <option value="LocalSystem">LocalSystem</option>
            <option value="LocalService">LocalService</option>
            <option value="NetworkService">NetworkService</option>
          </select>
          <span className="asm-hint">{t('service.modal.advanced.accountHint')}</span>
        </div>
        <div className="asm-field">
          <label>{t('service.modal.advanced.priority')}</label>
          <select className="asm-input asm-select" defaultValue="Normal">
            <option value="Normal">Normal</option>
            <option value="High">High</option>
            <option value="BelowNormal">BelowNormal</option>
          </select>
        </div>
        <div className="asm-field" style={{ gridColumn: '1 / -1' }}>
          <label>{t('service.modal.advanced.env')}</label>
          <input
            className="asm-input mono"
            placeholder="TZ=Asia/Shanghai; LANG=zh_CN"
            spellCheck={false}
          />
          <span className="asm-hint">{t('service.modal.advanced.envHint')}</span>
        </div>
      </div>
      <div className="asm-global-note">{t('service.modal.advanced.note')}</div>
    </div>
  );
};
