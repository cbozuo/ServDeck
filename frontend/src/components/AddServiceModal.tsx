import { Button, Modal, Tooltip, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  LeftOutlined,
  LoadingOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useI18n } from '../i18n/provider';
import { APP_NESTED_MODAL_Z_INDEX } from '../utils/overlayZIndex';
import {
  SERVICE_TEMPLATE_LIST,
  type ServiceTemplate,
} from '../addService/serviceTemplates';
import {
  AddServiceBasicSection,
  AddServiceLookPane,
  AddServiceParamsPane,
  AddServiceProgramSection,
  AddServiceStartSection,
  DEFAULT_SERVICE_LOOK,
  type ServiceLook,
} from '../addService/AddServicePanes';
import { useAddServiceForm } from '../addService/useAddServiceForm';
import { ProbeActionButton } from '../addService/ProbeActionButton';
import { useServiceRegistryStore } from '../serviceRegistryStore';
import { SelectDirectory, UninstallServyService } from '../../wailsjs/go/app/App';
import './AddServiceModal.css';

export interface AddServiceModalProps {
  open: boolean;
  onClose: () => void;
  zIndex?: number;
}

type Step = 'select' | 'config';
type TabKey = 'basic' | 'params' | 'look' | 'advanced';

/** 页签顺序（对齐走查结论）：基本 → 参数配置 → 高级（启动与守护）→ 外观。 */
const CONFIG_TABS: Array<[TabKey, string]> = [
  ['basic', 'service.modal.tab.basic'],
  ['params', 'service.modal.tab.params'],
  ['advanced', 'service.modal.tab.advanced'],
  ['look', 'service.modal.tab.look'],
];
/** 探测前要求浏览过的页签：这三个页签的取值直接影响注册结果。 */
const VISIT_REQUIRED_TABS: TabKey[] = ['basic', 'params', 'advanced'];

/**
 * 添加服务弹框（对齐高保真两步结构）：
 * Step1 选类型 → Step2 配参数（四 tab：基本 | 参数配置 | 外观 | 高级）。
 * 探测决定加入方式：服务已存在时以纳管模式接入（不重复注册），不存在时经 servy 注册。
 */
export const AddServiceModal: React.FC<AddServiceModalProps> = ({ open, onClose, zIndex }) => {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('select');
  const [templateId, setTemplateId] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('basic');
  const [probing, setProbing] = useState(false);
  const [look, setLook] = useState<ServiceLook>(DEFAULT_SERVICE_LOOK);
  /** 探测前要求浏览过的页签集合：落在基本页，点过哪页记哪页，换模板重置。 */
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<TabKey>>(() => new Set<TabKey>(['basic']));
  /** footer 提示条（页签浏览守卫 / 基本信息必填前置校验）。null 表示不展示；
       kind 决定它何时撤下：tabs 类在必看页签集齐后撤，basic 类在必填补齐后撤。 */
  const [probeNotice, setProbeNotice] = useState<{ kind: 'tabs' | 'basic'; text: string } | null>(null);
  /** 注册失败时 servy 写入的 stderr 日志尾部（弹窗内直接展示排障） */
  const [addLog, setAddLog] = useState('');
  /** 注册失败但 SCM 服务已装入：记录残留服务名，提供一键卸载 */
  const [residueName, setResidueName] = useState('');
  const addManagedService = useServiceRegistryStore((state) => state.addService);
  const removeManagedService = useServiceRegistryStore((state) => state.removeService);
  const managedServices = useServiceRegistryStore((state) => state.services);

  const template = useMemo(
    () => SERVICE_TEMPLATE_LIST.find((item) => item.id === templateId) ?? null,
    [templateId],
  );
  const form = useAddServiceForm(template ?? SERVICE_TEMPLATE_LIST[0]);
  // 服务名唯一（SCM 名称不区分大小写）：已在纳管列表里的服务不允许再次加入。
  const alreadyManaged = managedServices.some(
    (item) => item.name.toLowerCase() === form.basic.serviceName.trim().toLowerCase(),
  );

  const closeModal = useCallback(() => {
    onClose();
    setStep('select');
    setTemplateId('');
    setTab('basic');
    setLook(DEFAULT_SERVICE_LOOK);
  }, [onClose]);

  const chooseTemplate = (next: ServiceTemplate) => {
    setTemplateId(next.id);
    form.applyTemplate(next);
    // 换服务类型就换一套图标与配色，上一个类型挑的外观不能带过来
    setLook(DEFAULT_SERVICE_LOOK);
    setVisitedTabs(new Set<TabKey>(['basic']));
    setProbeNotice(null);
    setAddLog('');
    setTab('basic');
    setStep('config');
  };

  const switchTab = (key: TabKey) => {
    setTab(key);
    setVisitedTabs((prev) => {
      const next = prev.has(key) ? prev : new Set(prev).add(key);
      // 必看页签集齐后，「先查看页签」提示随之撤下
      if (VISIT_REQUIRED_TABS.every((tabKey) => next.has(tabKey))) {
        setProbeNotice((current) => (current?.kind === 'tabs' ? null : current));
      }
      return next;
    });
  };

  /* 基本信息必填补齐后，「请先填写…」提示随之撤下（按序口径与 runProbe 一致）。 */
  useEffect(() => {
    setProbeNotice((current) => {
      if (current?.kind !== 'basic') {
        return current;
      }
      const stillMissing =
        form.basic.programFile.trim() === '' ||
        form.basic.serviceName.trim() === '' ||
        form.basic.displayName.trim() === '';
      return stillMissing ? current : null;
    });
  }, [form.basic]);

  const runProbe = useCallback(async () => {
    /* 整个点击（含前置校验与页签浏览守卫）都属于探测动作：按钮统一走
       「探测中…」最短动画，被拦截时动画结束后再显示红色提示。
       ① 基本信息必填按序前置校验（程序文件 → 服务名 → 显示名称）；
       ② 页签浏览守卫；③ 通过后才发起探测（探测内部再做文件存在性等校验）。 */
    setProbing(true);
    try {
      // 先让「探测中」渲染一帧（宏任务边界），被校验/守卫拦截的路径也播放最短动画，
      // 否则 setProbing(true/false) 会被批处理成一次渲染，busy 态根本不出现。
      await new Promise((resolve) => setTimeout(resolve, 0));
      const basicMessage =
        form.basic.programFile.trim() === ''
          ? t('service.modal.probe.programRequired')
          : form.basic.serviceName.trim() === ''
            ? t('service.modal.probe.nameRequired')
            : form.basic.displayName.trim() === ''
              ? t('service.modal.probe.displayNameRequired')
              : '';
      if (basicMessage) {
        setProbeNotice({ kind: 'basic', text: basicMessage });
        return;
      }
      const missing = VISIT_REQUIRED_TABS.filter((key) => !visitedTabs.has(key));
      if (missing.length > 0) {
        setProbeNotice({
          kind: 'tabs',
          text: t('service.modal.probe.visitTabs', {
            tabs: missing.map((key) => t(CONFIG_TABS.find(([tabKey]) => tabKey === key)?.[1] ?? '')).join('、'),
          }),
        });
        return;
      }
      setProbeNotice(null);
      await form.probeNow();
    } finally {
      setProbing(false);
    }
  }, [form, t, visitedTabs]);

  /** 目录字段的「浏览…」：打开系统目录选择框，取消时返回 null 让调用方保持原值。 */
  const pickDirectory = useCallback(async (title: string, current: string) => {
    try {
      const result = await SelectDirectory(title, current);
      if (!result.success) {
        if (result.message) {
          void message.error(result.message);
        }
        return null;
      }
      const picked = typeof result.data === 'string' ? result.data.trim() : '';
      return picked || null;
    } catch (error) {
      void message.error(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, []);

  const addToManaged = useCallback(async () => {
    if (managedServices.some((item) => item.name === form.basic.serviceName.trim())) {
      return;
    }
    const result = await form.addToManaged();
    setAddLog(result.logTail ?? '');
    // 注册失败但 SCM 服务已装入（install 成功、启动失败）：仍加入纳管列表，
    // 否则孤儿服务无法从 UI 卸载（详情页/首页的卸载都依赖纳管记录）。
    const residue = !result.ok && result.installed === true && template;
    if (residue) {
      setResidueName(form.basic.serviceName.trim());
    } else {
      setResidueName('');
    }
    if (!result.ok && !residue) {
      return;
    }
    if (template) {
      const serviceName = form.basic.serviceName.trim();
      // 同名重填（manage/残留）：保留原记录的 mode 与注册参数快照，
      // 避免「已注册服务被 manage 覆盖成纳管态、丢失 deploy」的回归。
      const existing = managedServices.find((item) => item.name === serviceName);
      const mode = residue ? 'register' : (existing?.mode ?? result.mode);
      addManagedService({
        name: serviceName,
        serviceType: template.id,
        displayName: form.basic.displayName.trim() || form.basic.serviceName.trim(),
        mode,
        programFile: form.basic.programFile.trim(),
        addedAt: existing?.addedAt ?? new Date().toISOString(),
        groupId: existing?.groupId ?? null,
        // 仅在用户真的挑过自定义图标时才写，避免给每条记录都塞一份默认值；
        // 主色不限外观模式——「类型图标 + 自选主色」是合法组合，之前限定 custom 导致颜色被静默丢弃。
        iconDataUrl: look.mode === 'custom' && look.customIcon ? look.customIcon : (existing?.iconDataUrl ?? undefined),
        accentColor: look.color || existing?.accentColor,
        // 注册参数快照：详情页部署参数与「重新注册」的数据源（纳管模式无注册参数，不写）
        deploy: mode === 'register'
          ? {
              displayName: form.basic.displayName.trim() || form.basic.serviceName.trim(),
              description: form.basic.description?.trim() || undefined,
              programFile: form.basic.programFile.trim(),
              workDir: form.basic.programFile.trim().replace(/[\\/][^\\/]*$/, '') || undefined,
              javaPath: template.id === 'java' ? (String(form.values.jvmPath ?? '') || undefined) : undefined,
              jvmArgs: template.id === 'java' ? (String(form.values.jvmArgs ?? '') || undefined) : undefined,
              params: template.id === 'java' ? undefined : (template.params(form.values, form.basic.programFile.trim()) || undefined),
              startType: form.basic.startType,
              restart: form.basic.restart,
              rotate: form.basic.rotate,
              confName: template.conf?.name ?? undefined,
              confContent: template.conf ? template.conf.render(form.values, form.basic.programFile.trim()) || undefined : undefined,
            }
          : existing?.deploy,
      });
    }
    // 成功后不自动关闭：按钮停在「已加入纳管 ✓」，由用户自行关闭弹窗
  }, [addManagedService, form, look, managedServices, template]);

  /** 卸载注册失败留下的残留服务（servy uninstall，停止并移除 SCM 注册），并同步移出纳管列表。 */
  const handleUninstallResidue = useCallback(async () => {
    if (!residueName) {
      return;
    }
    try {
      const result = await UninstallServyService(residueName);
      if (!result.success) {
        message.error(result.message || t('detail.uninstall.failed'));
        return;
      }
      removeManagedService(residueName);
      setResidueName('');
      setAddLog('');
      form.setAddError('');
      message.success(t('service.modal.add.residueRemoved'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }, [removeManagedService, residueName, t]);

  const probePhase = form.probe.phase;
  const probeFileMissing = probePhase === 'ok' && !form.probe.fileExists;
  const primaryDisabled = probePhase === 'none'
    || probePhase === 'probing'
    || probePhase === 'error'
    || probeFileMissing
    || form.addPhase !== 'idle'
    || alreadyManaged;
  const stepIndex = step === 'select' ? 1 : 2;

  const stepsIndicator = useMemo(
    () => (
      <span className="asm-steps" aria-hidden="true">
        {(
          [
            ['1', t('service.modal.step.select')],
            ['2', t('service.modal.step.config')],
            ['3', t('service.modal.step.add')],
          ] as const
        ).map(([num, label], index) => (
          <React.Fragment key={num}>
            {index > 0 ? <RightOutlined className="asm-steps-arrow" /> : null}
            <span className={stepIndex === index + 1 ? 'on' : stepIndex > index + 1 ? 'done' : ''}>
              {num} {label}
            </span>
          </React.Fragment>
        ))}
      </span>
    ),
    [stepIndex, t],
  );

  return (
    <Modal
      open={open}
      onCancel={closeModal}
      centered
      width={760}
      footer={null}
      destroyOnHidden
      maskClosable={false}
      closable={false}
      /* 纳管中（servy 注册需数十秒）冻结 ESC/遮罩关闭，防止注册进行时弹窗被意外关掉 */
      keyboard={form.addPhase !== 'adding'}
      zIndex={zIndex ?? APP_NESTED_MODAL_Z_INDEX}
      wrapClassName="asm-modal"
      styles={{ header: { display: 'none' }, body: { padding: 0 } }}
    >
      <div className="asm-root">
        <header className="asm-head">
          <span
            className={`asm-head-ico${step === 'select' ? ' asm-head-ico-plus' : ''}`}
            style={
              step !== 'select' && template
                ? {
                    // 标题图标跟随外观 tab 的主色与自定义图标（与预览卡同一公式）；
                    // 默认空色 = 跟随主题 accent（深色/自定义主题自动适配）
                    background: `color-mix(in srgb, ${look.color || 'var(--gn-accent)'} 16%, var(--gn-bg-panel))`,
                    borderColor: `color-mix(in srgb, ${look.color || 'var(--gn-accent)'} 32%, transparent)`,
                  }
                : undefined
            }
          >
            {step !== 'select' && template ? (
              <img
                src={look.mode === 'custom' && look.customIcon ? look.customIcon : template.iconSrc}
                alt=""
              />
            ) : (
              <PlusOutlined />
            )}
          </span>
          <div className="asm-title">
            <h2>
              {step === 'select'
                ? t('service.modal.title.select')
                : t('service.modal.title.config', { type: template ? t(template.labelKey) : '' })}
            </h2>
            <p>
              {step === 'select'
                ? t('service.modal.desc.select')
                : t('service.modal.desc.config')}
            </p>
          </div>
          {stepsIndicator}
          <Button
            type="text"
            className="asm-close"
            icon={<CloseOutlined />}
            disabled={form.addPhase === 'adding'}
            onClick={closeModal}
            aria-label={t('common.close')}
          />
        </header>

        {step === 'select' ? (
          <div className="asm-body">
            <div className="asm-sec">
              <div className="asm-sec-title">{t('service.modal.select.heading')}</div>
              <div className="asm-type-grid">
                {SERVICE_TEMPLATE_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="asm-type-card"
                    onClick={() => chooseTemplate(item)}
                  >
                    <span className="asm-type-top">
                      <span className="asm-type-ico">
                        <img src={item.iconSrc} alt="" />
                      </span>
                      <span className="asm-type-name-wrap">
                        <span className="asm-type-name">{t(item.labelKey)}</span>
                        <span className="asm-type-desc">{t(item.cardDescKey)}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <React.Fragment>
            <div className="asm-tabs">
              {CONFIG_TABS.map(([key, labelKey]) => (
                <button
                  key={key}
                  type="button"
                  className={tab === key ? 'active' : ''}
                  onClick={() => switchTab(key)}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <div className="asm-body">
            {template ? (
              tab === 'basic' ? (
                <React.Fragment>
                  <AddServiceProgramSection
                    template={template}
                    programFile={form.basic.programFile}
                    onChange={(value) => form.setBasicField('programFile', value)}
                  />
                  <AddServiceBasicSection
                    programFile={form.basic.programFile}
                    serviceName={form.basic.serviceName}
                    displayName={form.basic.displayName}
                    description={form.basic.description}
                    onNameChange={(value) => form.setBasicField('serviceName', value)}
                    onDisplayNameChange={(value) => form.setBasicField('displayName', value)}
                    onDescriptionChange={(value) => form.setBasicField('description', value)}
                  />
                </React.Fragment>
              ) : tab === 'params' ? (
                <AddServiceParamsPane
                  template={template}
                  values={form.values}
                  onChange={form.setFieldValue}
                  onPickDirectory={pickDirectory}
                  nestedZIndex={zIndex ?? APP_NESTED_MODAL_Z_INDEX}
                />
              ) : tab === 'look' ? (
                <AddServiceLookPane
                  template={template}
                  value={look}
                  onChange={setLook}
                />
              ) : (
                /* 高级 = 启动与守护：注册类启动项（启动类型 / 崩溃重启 / 轮转），其余装饰性
                   高级字段（运行账户 / 进程优先级 / 环境变量）未接入注册链路，已删除。 */
                <AddServiceStartSection
                  startType={form.basic.startType}
                  restart={form.basic.restart}
                  rotate={form.basic.rotate}
                  autoStart={form.basic.autoStart}
                  onStartTypeChange={(value) => form.setBasicField('startType', value)}
                  onRestartChange={(value) => form.setBasicField('restart', value)}
                  onRotateChange={(value) => form.setBasicField('rotate', value)}
                  onAutoStartChange={(value) => form.setBasicField('autoStart', value)}
                />
              )
            ) : null}
            </div>
          </React.Fragment>
        )}

        {step === 'config' ? (
          <footer className="asm-foot">
            {form.addError ? (
              /* 注册失败的完整反馈（错误结论 + stderr 日志 + 残留卸载）：
                 优先且唯一 —— 已装入 SCM 的失败同时会触发重名提示，这里不重复展示。 */
              <>
                <div className="asm-probe-bar error show">
                  <span className="asm-probe-ico">
                    <CloseOutlined />
                  </span>
                  <span className="asm-probe-text">{form.addError}</span>
                  {residueName ? (
                    <button type="button" className="dtl-btn-sm danger-o" onClick={() => void handleUninstallResidue()}>
                      {t('service.modal.add.residueUninstall')}
                    </button>
                  ) : null}
                </div>
                {addLog ? (
                  <pre className="asm-add-log mono" title={t('service.modal.add.logTail')}>{addLog}</pre>
                ) : null}
              </>
            ) : alreadyManaged ? (
              /* 与已纳管服务重名 = 报错：不能重复添加，需更换服务名后重新探测。 */
              <div className="asm-probe-bar error show">
                <span className="asm-probe-ico">
                  <CloseOutlined />
                </span>
                <span className="asm-probe-text">
                  {t('service.modal.managed.duplicate', { name: form.basic.serviceName.trim() })}
                  <small>{t('service.modal.managed.duplicateHint')}</small>
                </span>
              </div>
            ) : probeNotice ? (
              /* 页签浏览守卫 / 基本信息必填前置校验：属于阻断操作的错误提示，红色 danger 态。 */
              <div className="asm-probe-bar error center">
                <span className="asm-probe-ico">
                  <ExclamationCircleFilled />
                </span>
                <span className="asm-probe-text">{probeNotice.text}</span>
              </div>
            ) : probeFileMissing || probePhase === 'error' ? (
              /* 基本信息没填对（文件缺失 / 服务名问题等）：信息提示而非报错——
                 还没探测通过，谈不上「失败」，填好再点探测即可。 */
              <div className="asm-probe-bar info show">
                <span className="asm-probe-ico">
                  <InfoCircleFilled />
                </span>
                <span className="asm-probe-text">
                  {probeFileMissing
                    ? t('service.modal.probe.fileMissing', { file: form.probe.missingFile || '' })
                    : form.probe.message}
                </span>
              </div>
            ) : probePhase !== 'none' ? (
              <div className={`asm-probe-bar ${probePhase === 'exists' ? 'info' : 'ok'}`}>
                <span className="asm-probe-ico">
                  {probePhase === 'exists' ? <InfoCircleFilled /> : <CheckCircleFilled />}
                </span>
                <span className="asm-probe-text">
                  {probePhase === 'exists'
                    ? t('service.modal.probe.exists', {
                        name: form.basic.serviceName,
                        state: form.probe.state ?? '',
                        startType: form.probe.startType ?? '',
                      })
                    : t('service.modal.probe.ok', { name: form.basic.serviceName })}
                  <small>
                    {probePhase === 'exists'
                      ? t('service.modal.probe.existsHint')
                      : t('service.modal.probe.okHint')}
                  </small>
                </span>
              </div>
            ) : null}
            <div className="asm-foot-main">
              <Button
                type="text"
                className="asm-back"
                icon={<LeftOutlined />}
                disabled={form.addPhase === 'adding'}
                onClick={() => setStep('select')}
              >
                {t('service.modal.footer.back')}
              </Button>
              <span className="asm-foot-status">
                {residueName ? (
                  t('service.modal.footer.statusResidue')
                ) : alreadyManaged
                  ? t('service.modal.managed.status')
                  : probePhase === 'exists'
                    ? t('service.modal.footer.statusManaged', { name: template ? t(template.labelKey) : '' })
                    : probePhase === 'ok'
                      ? t('service.modal.footer.statusRegister', { name: template ? t(template.labelKey) : '' })
                      : t('service.modal.footer.statusUnprobed', {
                          type: template ? t(template.labelKey) : '',
                        })}
              </span>
              <span className="asm-foot-spring" />
              <div className="asm-foot-actions">
                <Tooltip title={t('service.modal.probe.actionTip')} placement="top">
                  <ProbeActionButton
                    probing={probing}
                    phase={probePhase}
                    failed={probePhase === 'error' || probeFileMissing || probeNotice?.kind === 'basic'}
                    disabled={form.addPhase === 'adding' || alreadyManaged}
                    onProbe={() => void runProbe()}
                  />
                </Tooltip>
                <Button className="asm-btn-ghost" disabled={form.addPhase === 'adding'} onClick={closeModal}>
                  {t('common.cancel')}
                </Button>
                <Tooltip title={primaryDisabled && !form.addPhase ? (alreadyManaged
                  ? t('service.modal.managed.duplicate', { name: form.basic.serviceName.trim() })
                  : t('service.modal.probe.required')) : ''}
                >
                  <Button
                    type="primary"
                    className={primaryDisabled && !form.addPhase ? 'asm-btn-disabled' : ''}
                    disabled={primaryDisabled && form.addPhase !== 'adding'}
                    loading={form.addPhase === 'adding'}
                    icon={
                      form.addPhase === 'done' ? (
                        <CheckCircleFilled />
                      ) : (
                        <RightOutlined />
                      )
                    }
                    onClick={() => void addToManaged()}
                  >
                    {form.addPhase === 'adding'
                      ? t('service.modal.footer.adding')
                      : form.addPhase === 'done'
                        ? t('service.modal.footer.added')
                        : t('service.modal.footer.addToManaged')}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </footer>
        ) : (
          <footer className="asm-foot asm-foot-select">
            <span className="asm-foot-hint">{t('service.modal.select.footerHint')}</span>
          </footer>
        )}
      </div>
    </Modal>
  );
};
