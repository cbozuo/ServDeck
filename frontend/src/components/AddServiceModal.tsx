import { Button, Modal, Tooltip, message } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import {
  CheckCircleFilled,
  CloseOutlined,
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
  AddServiceAdvancedPane,
  AddServiceBasicSection,
  AddServiceLookPane,
  AddServiceParamsPane,
  AddServiceProgramSection,
  AddServiceStartSection,
  DEFAULT_SERVICE_LOOK,
  type ServiceLook,
} from '../addService/AddServicePanes';
import { useAddServiceForm } from '../addService/useAddServiceForm';
import { useServiceRegistryStore } from '../serviceRegistryStore';
import { SelectDirectory } from '../../wailsjs/go/app/App';
import './AddServiceModal.css';

export interface AddServiceModalProps {
  open: boolean;
  onClose: () => void;
  zIndex?: number;
}

type Step = 'select' | 'config';
type TabKey = 'basic' | 'params' | 'look' | 'advanced';

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
  const addManagedService = useServiceRegistryStore((state) => state.addService);
  const managedServices = useServiceRegistryStore((state) => state.services);

  const template = useMemo(
    () => SERVICE_TEMPLATE_LIST.find((item) => item.id === templateId) ?? null,
    [templateId],
  );
  const form = useAddServiceForm(template ?? SERVICE_TEMPLATE_LIST[0]);
  // 服务名唯一：已在纳管列表里的服务不允许再次加入（无论是注册还是纳管模式）。
  const alreadyManaged = managedServices.some(
    (item) => item.name === form.basic.serviceName.trim(),
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
    setStep('config');
  };

  const runProbe = useCallback(async () => {
    setProbing(true);
    try {
      await form.probeNow();
    } finally {
      setProbing(false);
    }
  }, [form]);

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
    if (!result.ok || !template) {
      return;
    }
    addManagedService({
      name: form.basic.serviceName.trim(),
      serviceType: template.id,
      displayName: form.basic.displayName.trim() || form.basic.serviceName.trim(),
      mode: result.mode,
      programFile: form.basic.programFile.trim(),
      addedAt: new Date().toISOString(),
      groupId: null,
      // 仅在用户真的挑过自定义外观时才写，避免给每条记录都塞一份默认值
      iconDataUrl: look.mode === 'custom' && look.customIcon ? look.customIcon : undefined,
      accentColor: look.mode === 'custom' ? look.color : undefined,
    });
    closeModal();
  }, [addManagedService, closeModal, form, look, managedServices, template]);

  const probePhase = form.probe.phase;
  const probeFileMissing = probePhase === 'ok' && !form.probe.fileExists;
  const primaryDisabled = probePhase === 'none'
    || probePhase === 'probing'
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
      zIndex={zIndex ?? APP_NESTED_MODAL_Z_INDEX}
      wrapClassName="asm-modal"
      styles={{ header: { display: 'none' }, body: { padding: 0 } }}
    >
      <div className="asm-root">
        <header className="asm-head">
          <span className={`asm-head-ico${step === 'select' ? ' asm-head-ico-plus' : ''}`}>
            {step !== 'select' && template ? (
              <img src={template.iconSrc} alt="" />
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
                    <span className="asm-type-tags">
                      {item.tags.map((tag) => (
                        <span
                          key={tag.labelKey}
                          className={tag.hot ? 'asm-tag asm-tag-hot' : 'asm-tag'}
                        >
                          {t(tag.labelKey)}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <React.Fragment>
            <div className="asm-tabs">
              {(
                [
                  ['basic', t('service.modal.tab.basic')],
                  ['params', t('service.modal.tab.params')],
                  ['look', t('service.modal.tab.look')],
                  ['advanced', t('service.modal.tab.advanced')],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={tab === key ? 'active' : ''}
                  onClick={() => setTab(key)}
                >
                  {label}
                  {key === 'params' && template ? (
                    <span className="asm-tab-badge">{t(template.labelKey)}</span>
                  ) : null}
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
                    serviceName={form.basic.serviceName}
                    displayName={form.basic.displayName}
                    onNameChange={(value) => form.setBasicField('serviceName', value)}
                    onDisplayNameChange={(value) => form.setBasicField('displayName', value)}
                  />
                  <AddServiceStartSection
                    startType={form.basic.startType}
                    restart={form.basic.restart}
                    onStartTypeChange={(value) => form.setBasicField('startType', value)}
                    onRestartChange={(value) => form.setBasicField('restart', value)}
                  />
                </React.Fragment>
              ) : tab === 'params' ? (
                <AddServiceParamsPane
                  template={template}
                  values={form.values}
                  onChange={form.setFieldValue}
                  onPickDirectory={pickDirectory}
                />
              ) : tab === 'look' ? (
                <AddServiceLookPane
                  template={template}
                  value={look}
                  onChange={setLook}
                />
              ) : (
                <AddServiceAdvancedPane />
              )
            ) : null}
            </div>
          </React.Fragment>
        )}

        {step === 'config' ? (
          <footer className="asm-foot">
            {alreadyManaged ? (
              <div className="asm-probe-bar info">
                <span className="asm-probe-ico">
                  <InfoCircleFilled />
                </span>
                <span className="asm-probe-text">
                  {t('service.modal.managed.exists', { name: form.basic.serviceName.trim() })}
                  <small>{t('service.modal.managed.existsHint')}</small>
                </span>
              </div>
            ) : probeFileMissing ? (
              <div className="asm-probe-bar error show">
                <span className="asm-probe-ico">
                  <CloseOutlined />
                </span>
                <span className="asm-probe-text">
                  {t('service.modal.probe.fileMissing', { file: form.probe.missingFile || '' })}
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
            {form.addError ? (
              <div className="asm-probe-bar error show">
                <span className="asm-probe-ico">
                  <CloseOutlined />
                </span>
                <span className="asm-probe-text">{form.addError}</span>
              </div>
            ) : null}
            <div className="asm-foot-main">
              <Button
                type="text"
                className="asm-back"
                icon={<LeftOutlined />}
                onClick={() => setStep('select')}
              >
                {t('service.modal.footer.back')}
              </Button>
              <span className="asm-foot-status">
                {alreadyManaged
                  ? t('service.modal.managed.status')
                  : probePhase === 'exists'
                    ? t('service.modal.footer.statusManaged', { name: template ? t(template.labelKey) : '' })
                    : probePhase === 'ok'
                      ? t('service.modal.footer.statusRegister', { name: template ? t(template.labelKey) : '' })
                      : t('service.modal.footer.statusUnprobed', {
                          type: template ? t(template.labelKey) : '',
                        })}
              </span>
              <Tooltip title={t('service.modal.footer.previewTitle')} placement="top">
                <Button
                  type="text"
                  className="asm-cmd-toggle"
                  icon={<RightOutlined style={{ transform: 'rotate(-90deg)' }} />}
                  onClick={(event) => {
                    const box = (event.currentTarget as HTMLElement)
                      .closest('.asm-foot')
                      ?.querySelector('.asm-cmd-box');
                    box?.classList.toggle('show');
                  }}
                >
                  {t('service.modal.footer.preview')}
                </Button>
              </Tooltip>
              <span className="asm-foot-spring" />
              <div className="asm-foot-actions">
                <Button
                  type="text"
                  className="asm-probe-btn"
                  icon={probing ? <LoadingOutlined /> : <RightOutlined style={{ transform: 'rotate(90deg)' }} />}
                  disabled={probing}
                  onClick={() => void runProbe()}
                >
                  {probing
                    ? t('service.modal.probe.probing')
                    : probePhase === 'none'
                      ? t('service.modal.probe.action')
                      : t('service.modal.probe.again')}
                </Button>
                <Button className="asm-btn-ghost" onClick={closeModal}>
                  {t('common.cancel')}
                </Button>
                <Tooltip title={primaryDisabled
                  ? (alreadyManaged ? t('service.modal.managed.exists', { name: form.basic.serviceName.trim() }) : t('service.modal.probe.required'))
                  : ''}
                >
                  <Button
                    type="primary"
                    className={primaryDisabled ? 'asm-btn-disabled' : ''}
                    disabled={primaryDisabled}
                    icon={
                      form.addPhase === 'adding' ? (
                        <LoadingOutlined />
                      ) : form.addPhase === 'done' ? (
                        <CheckCircleFilled />
                      ) : (
                        <RightOutlined />
                      )
                    }
                    onClick={() => void addToManaged()}
                  >
                    {form.addPhase === 'done'
                      ? t('service.modal.footer.added')
                      : t('service.modal.footer.addToManaged')}
                  </Button>
                </Tooltip>
              </div>
            </div>
            <pre className="asm-cmd-box">{form.previewCommand}</pre>
          </footer>
        ) : (
          <footer className="asm-foot">
            <div className="asm-foot-main">
              <span className="asm-foot-spring" />
              <div className="asm-foot-actions">
                <Button className="asm-btn-ghost" onClick={closeModal}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="primary"
                  icon={<RightOutlined />}
                  disabled={!template}
                  onClick={() => setStep('config')}
                >
                  {t('service.modal.footer.next')}
                </Button>
              </div>
            </div>
          </footer>
        )}
      </div>
    </Modal>
  );
};
