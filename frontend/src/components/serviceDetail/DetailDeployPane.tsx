import React, { useMemo, useState } from 'react';
import { CheckCircleFilled, CopyOutlined, ExclamationCircleFilled, InfoCircleFilled, LockFilled } from '@ant-design/icons';
import { Tooltip, message } from 'antd';
import { useI18n } from '../../i18n/provider';
import { HeapMemoryField } from '../../addService/HeapMemoryField';
import { JdkPickerModal } from '../../addService/JdkPickerModal';
import { JavaCupIcon } from '../../addService/AddServicePanes';
import { SegmentedControl } from '../../addService/SegmentedControl';
import { SERVICE_TEMPLATES, SERVICE_START_TYPES, type ServiceTemplate } from '../../addService/serviceTemplates';
import { APP_NESTED_MODAL_Z_INDEX } from '../../utils/overlayZIndex';
import type { ServiceDeploySnapshot } from '../../serviceRegistryStore';
import type { ServiceDetailInfo } from './useServiceDetail';

export interface DetailDeployPaneProps {
  info: ServiceDetailInfo | null;
  serviceType: string;
  deploy: ServiceDeploySnapshot | null;
  deployDirty: boolean;
  locked: boolean;
  /** 进程运行中（区别于 pending 转场）：锁定条与「已锁定」只对运行态展示 */
  running: boolean;
  /** SCM 中是否存在此服务；false = 已卸载/未注册，状态卡与主行动切换为「注册」形态 */
  installed: boolean;
  accentColor?: string;
  onDeployChange: (next: ServiceDeploySnapshot) => void;
  onStopForEdit: () => void;
  onReRegister: () => void;
  onConfSave: (file: string, content: string) => void;
  /** 纳管记录的加入时间（ISO），显示在「注册时间」行 */
  addedAt?: string;
}

/** 安装命令预览（对应 servy-cli install；与后端 buildServyInstallArgs 同口径）。 */
function buildInstallPreview(deploy: ServiceDeploySnapshot, serviceType: string, name: string): string {
  const q = (value: string): string => `"${value}"`;
  const args: string[] = [
    'install',
    '--name', q(name),
    '-p', q(deploy.javaPath || deploy.programFile),
    '--displayName', q(deploy.displayName),
    '--startupDir', q(deploy.workDir || deploy.programFile.replace(/[\\/][^\\/]*$/, '')),
    '--startupType', q(deploy.startType),
    '--stdout', q('<LOG_DIR>\\service-out.log'),
    '--stderr', q('<LOG_DIR>\\service-err.log'),
  ];
  if (deploy.description) {
    args.push('--description', q(deploy.description));
  }
  const params = serviceType === 'java'
    ? deploy.jvmArgs ?? ''
    : deploy.params ?? '';
  if (params) {
    args.push('--params', q(params));
  }
  if (deploy.restart) {
    args.push('--enableSizeRotation');
  }
  const install = ['servy-cli.exe', ...args].join(' ');
  const start = `servy-cli.exe start --name ${q(name)}`;
  return `${install}\n${start}`;
}

const templateOf = (serviceType: string): ServiceTemplate | null =>
  (SERVICE_TEMPLATES as Record<string, ServiceTemplate | undefined>)[serviceType] ?? null;

const START_TYPE_OPTIONS = SERVICE_START_TYPES;

/** 启动类型文案（与 AddServiceStartSection 同口径：Automatic (Delayed) 小写后打不中键名，需特判）。 */
const startTypeLabel = (value: string): string => {
  if (value === 'Automatic (Delayed)') {
    return 'service.modal.startType.autoDelayed';
  }
  if (value === 'Automatic') {
    return 'service.modal.startType.automatic';
  }
  return `service.modal.startType.${value.toLowerCase()}`;
};

/** 部署参数页签：托管状态卡 + 纳管信息（只读）+ 运行参数表单（运行中锁定）+ 安装命令预览 + 配置文件托管。 */
export const DetailDeployPane: React.FC<DetailDeployPaneProps> = ({
  info,
  serviceType,
  deploy,
  deployDirty,
  locked,
  running,
  installed,
  accentColor,
  addedAt,
  onDeployChange,
  onStopForEdit,
  onReRegister,
  onConfSave,
}) => {
  const { t } = useI18n();
  const [jdkOpen, setJdkOpen] = useState(false);
  const jvmPathInputRef = React.useRef<HTMLInputElement>(null);
  const jvmArgsInputRef = React.useRef<HTMLInputElement>(null);
  /** 操作堆内存滑杆 / 开关后，JVM 参数输入框回到聚焦态（与添加弹框 focusJvmArgs 同交互） */
  const focusJvmArgs = () => {
    const el = jvmArgsInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  };
  const hc = accentColor || 'var(--gn-accent)';
  const template = templateOf(serviceType);
  const isJava = template?.id === 'java';
  /** 轮转显示值：旧快照缺省跟随守护开关（与添加弹框注册时的取值一致） */
  const rotateOn = deploy ? (deploy.rotate ?? deploy.restart) : false;

  const registeredAtText = useMemo(() => {
    if (!addedAt) return '—';
    const d = new Date(addedAt);
    if (Number.isNaN(d.getTime())) return '—';
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }, [addedAt]);

  const patch = (partial: Partial<ServiceDeploySnapshot>) => {
    if (deploy) {
      onDeployChange({ ...deploy, ...partial });
    }
  };

  const toggleFlag = (flag: string) => {
    if (!deploy) return;
    const has = deploy.jvmArgs?.includes(flag) ?? false;
    const args = has
      ? deploy.jvmArgs?.replace(flag, '').replace(/\s+/g, ' ').trim()
      : `${deploy.jvmArgs ?? ''} ${flag}`.trim();
    patch({ jvmArgs: args });
  };

  const command = useMemo(() => {
    if (!deploy) return '';
    return buildInstallPreview(deploy, serviceType, info?.name ?? '');
  }, [deploy, info?.name, serviceType]);

  void template;

  const hostPort = info ? '' : '';
  void hostPort;

  if (!deploy) {
    return (
      <div className="dtl-pane">
        <div className="dtl-empty">
          <InfoCircleFilled className="dtl-empty-ico" />
          <h4>{t('detail.deploy.emptyTitle')}</h4>
          <p>{t('detail.deploy.emptyBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dtl-pane">
      {/* 托管状态卡：按 SCM 实际注册状态渲染（已注册 / 未注册） */}
      {installed ? (
        <div className="dtl-inst-card ok">
          <CheckCircleFilled className="dtl-inst-ico" />
          <div>
            <b>{t('detail.deploy.managedTitle')}</b>
            <span className="dtl-badge run">{t('detail.deploy.registered')}</span>
            <p>{t('detail.deploy.managedBody')}</p>
          </div>
        </div>
      ) : (
        <div className="dtl-inst-card unreg">
          <InfoCircleFilled className="dtl-inst-ico" />
          <div>
            <b>{t('detail.deploy.unregTitle')}</b>
            <p>{t('detail.deploy.unregBody')}</p>
          </div>
        </div>
      )}

      {/* 纳管信息（恒只读） */}
      <div className="dtl-panel">
        <div className="dtl-panel-head">
          <span>{t('detail.deploy.adoptedTitle')}</span>
          <span className="dtl-chip">{t('detail.deploy.readOnly')}</span>
        </div>
        <div className="dtl-kv-list">
          <div className="dtl-kv"><span>{t('detail.kv.name')}</span><b>{info?.name || '—'}</b></div>
          <div className="dtl-kv"><span>{t('detail.kv.displayName')}</span><b>{info?.displayName || deploy.displayName}</b></div>
          <div className="dtl-kv">
            <span>{t('detail.kv.programFile')}</span>
            <b className="mono ellipsis">{deploy.programFile || info?.programFile || '—'}</b>
          </div>
          <div className="dtl-kv"><span>{t('detail.kv.description')}</span><b>{info?.description || '—'}</b></div>
          <div className="dtl-kv"><span>{t('detail.kv.registeredAt')}</span><b className="mono">{registeredAtText}</b></div>
        </div>
      </div>

      {/* 运行参数（运行中锁定） */}
      <div className="dtl-panel">
        <div className="dtl-panel-head">
          <span>{t('detail.deploy.runtimeTitle')}</span>
          {running && <span className="dtl-chip lock"><LockFilled />{t('detail.deploy.locked')}</span>}
          {deployDirty && <span className="dtl-chip dirty">{t('detail.deploy.dirty')}</span>}
        </div>

        {running && (
          <div className="dtl-lock-bar">
            <ExclamationCircleFilled />
            <span>{t('detail.deploy.lockBody')}</span>
            <button type="button" className="dtl-btn-sm" onClick={onStopForEdit}>
              {t('detail.deploy.stopForEdit')}
            </button>
          </div>
        )}

        <div className={`dtl-fields${locked ? ' locked' : ''}`}>
          {isJava && (
            <div className="dtl-field span2">
              <label>{t('service.field.jvmPath')}</label>
              {/* JDK 弹框打开期间容器保持选中环（jdk-hold）、图标保持高亮（on）；
                  关闭后 on 摘除，焦点经 onClosed 还原输入框，选中环保持到点击其它位置。 */}
              <div className={`dtl-input dtl-input-with-act${jdkOpen ? ' jdk-hold' : ''}`}>
                <input
                  ref={jvmPathInputRef}
                  className="mono"
                  value={deploy.javaPath ?? ''}
                  readOnly={locked}
                  onChange={(event) => patch({ javaPath: event.target.value })}
                />
                <Tooltip title={t('service.modal.jdk.pick')} placement="top">
                  <button
                    type="button"
                    className={jdkOpen ? 'dtl-in-act on' : 'dtl-in-act'}
                    disabled={locked}
                    onClick={() => setJdkOpen(true)}
                  >
                    <JavaCupIcon />
                  </button>
                </Tooltip>
              </div>
            </div>
          )}
          {isJava && (
            <div className="dtl-field span2">
              <label>{t('service.field.jvmArgs')}</label>
              <div className="dtl-input">
                <input
                  ref={jvmArgsInputRef}
                  className="mono"
                  value={deploy.jvmArgs ?? ''}
                  readOnly={locked}
                  onChange={(event) => patch({ jvmArgs: event.target.value })}
                />
              </div>
            </div>
          )}
          {!isJava && (
            <div className="dtl-field span2">
              <label>{t('service.field.appArgs')}</label>
              <div className="dtl-input">
                <input
                  className="mono"
                  value={deploy.params ?? ''}
                  readOnly={locked}
                  onChange={(event) => patch({ params: event.target.value })}
                />
              </div>
            </div>
          )}
          {isJava && (
            <div className="dtl-field span2">
              <label>
                {t('service.field.presets')}
                <span className="dtl-label-hint">{t('service.field.presetsHint')}</span>
              </label>
              {/* 滑杆/开关行对齐添加弹框：行首「堆内存」「开关」标签；操作后 JVM 参数框回到聚焦态 */}
              <div className="asm-preset-row">
                <span className="asm-preset-label">{t('service.field.heapShort')}</span>
                <HeapMemoryField
                  jvmArgs={deploy.jvmArgs ?? ''}
                  disabled={locked}
                  onChange={(value) => {
                    patch({ jvmArgs: value });
                    focusJvmArgs();
                  }}
                />
              </div>
              <div className="asm-preset-row">
                <span className="asm-preset-label">{t('service.field.flagsLabel')}</span>
                <div className="dtl-chips">
                  {[
                    ['-XX:+HeapDumpOnOutOfMemoryError', t('detail.flag.oom')],
                    ['-XX:+UseG1GC', t('detail.flag.g1')],
                    ['-XX:+UseZGC', t('detail.flag.zgc')],
                    ['-Dfile.encoding=UTF-8', t('detail.flag.utf8')],
                    ['-Duser.timezone=Asia/Shanghai', t('detail.flag.tz')],
                  ].map(([flag, label]) => (
                    <button
                      key={flag}
                      type="button"
                      className={`dtl-flag${deploy.jvmArgs?.includes(flag) ? ' on' : ''}`}
                      disabled={locked}
                      onClick={() => {
                        toggleFlag(flag);
                        focusJvmArgs();
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="dtl-field span2">
            <label>{t('service.modal.basic.startType')}</label>
            <SegmentedControl
              accent
              options={START_TYPE_OPTIONS.map((value: string) => ({
                value,
                label: t(startTypeLabel(value)),
                disabled: locked,
              }))}
              value={deploy.startType}
              onChange={(value) => patch({ startType: value })}
              ariaLabel={t('service.modal.basic.startType')}
            />
          </div>
          <div className="dtl-field span2">
            <label>{t('service.modal.basic.guardRotate')}</label>
            <div className="dtl-switch-line">
              <span
                className={`dtl-switch${deploy.restart ? ' on' : ''}`}
                role="switch"
                aria-checked={deploy.restart}
                onClick={() => !locked && patch({ restart: !deploy.restart })}
              >
                <i />
              </span>
              <span className="dtl-switch-name">
                {t('service.modal.basic.guard')}
                <small>{t('service.modal.basic.guardHint')}</small>
              </span>
              <span
                className={`dtl-switch${rotateOn ? ' on' : ''}`}
                role="switch"
                aria-checked={rotateOn}
                onClick={() => !locked && patch({ rotate: !rotateOn })}
              >
                <i />
              </span>
              <span className="dtl-switch-name">
                {t('service.modal.basic.rotate')}
                <small className="mono">{t('service.modal.basic.rotateHint')}</small>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* JDK 选择弹框（与添加服务弹窗同款）；关闭后焦点还原 JVM 路径输入框，选中环保持 */}
      <JdkPickerModal
        open={jdkOpen}
        currentPath={deploy.javaPath ?? ''}
        zIndex={APP_NESTED_MODAL_Z_INDEX + 60}
        onClose={() => setJdkOpen(false)}
        onClosed={() => jvmPathInputRef.current?.focus()}
        onApply={(path) => patch({ javaPath: path })}
      />

      {/* 安装命令预览 */}
      <div className="dtl-panel">
        <div className="dtl-panel-head">
          <span>{t('detail.deploy.cmdTitle')}</span>
          <button
            type="button"
            className="dtl-in-act"
            title={t('detail.deploy.copyCmd')}
            onClick={() => {
              void navigator.clipboard?.writeText(command);
              message.success(t('app.engine.message.copied'));
            }}
          >
            <CopyOutlined />
          </button>
        </div>
        <pre className="dtl-cmd mono">{command}</pre>
        {/* 只留提示文案：注册入口统一走页面底部的「重新注册」主按钮（两处按钮冗余，用户反馈） */}
        <div className="dtl-restart-bar" style={{ visibility: deployDirty ? 'visible' : 'hidden' }}>
          <ExclamationCircleFilled />
          <span>{t('detail.deploy.dirtyHint')}</span>
        </div>
      </div>

      {/* 注册主行动：已注册=重新注册写回 SCM；未注册=装入系统服务 */}
      <button type="button" className="dtl-btn primary dtl-deploy-cta" style={{ borderColor: hc }} onClick={onReRegister}>
        <CheckCircleFilled />
        {t(installed ? 'detail.action.reRegister' : 'detail.action.register')}
      </button>
    </div>
  );
};
