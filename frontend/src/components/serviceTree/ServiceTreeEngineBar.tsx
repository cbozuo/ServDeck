import React, { useCallback, useEffect, useState } from 'react';
import { SafetyOutlined, WarningFilled } from '@ant-design/icons';
import { useI18n } from '../../i18n/provider';
import { LocateServyEngine } from '../../../wailsjs/go/app/App';
import './serviceTreeSidebar.css';

type EngineBarState = {
  available: boolean;
  name: string;
  version: string;
  path: string;
};

/** 解析 LocateServyEngine 的返回；后端不可达（非 Windows 构建等）按未找到处理。 */
const toEngineState = (data: unknown): EngineBarState => {
  const payload = (data ?? {}) as { available?: boolean; path?: string; version?: string };
  const path = String(payload.path || '');
  return {
    available: payload.available === true && path !== '',
    path,
    version: String(payload.version || ''),
    name: path ? path.split(/[\\/]/).pop() || '' : '',
  };
};

/** 服务树侧栏底部的 servy 引擎状态栏：就绪时展示名称与版本，未找到时点击跳转设置页配置。 */
export const ServiceTreeEngineBar: React.FC = () => {
  const { t } = useI18n();
  const [engine, setEngine] = useState<EngineBarState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await LocateServyEngine();
      setEngine(toEngineState(result?.data));
    } catch {
      setEngine({ available: false, name: '', version: '', path: '' });
    }
  }, []);

  useEffect(() => {
    void refresh();
    // 设置页保存引擎路径后刷新侧栏状态
    const handleUpdated = () => {
      void refresh();
    };
    window.addEventListener('gonavi:servy-engine-updated', handleUpdated);
    return () => window.removeEventListener('gonavi:servy-engine-updated', handleUpdated);
    // refresh 是稳定的 useCallback。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!engine) {
    return null;
  }

  if (engine.available) {
    return (
      <div
        className="gst-engine-bar is-ok"
        data-servy-engine-bar="ok"
        title={engine.version ? `${engine.path} · v${engine.version}` : engine.path}
      >
        <span className="gst-engine-bar__dot" />
        <SafetyOutlined className="gst-engine-bar__shield" />
        <span className="gst-engine-bar__text">
          {engine.name}
          <i>·</i>
          {t('home.engine.ready')}
        </span>
        <span className="gst-engine-bar__ver">{engine.version ? `v${engine.version}` : ''}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="gst-engine-bar is-missing"
      data-servy-engine-bar="missing"
      title={t('home.engine.missingTooltip')}
      onClick={() => window.dispatchEvent(new CustomEvent('gonavi:open-servy-engine-settings'))}
    >
      <WarningFilled className="gst-engine-bar__warn" />
      <span className="gst-engine-bar__text">{t('home.engine.missing')}</span>
      <span className="gst-engine-bar__action">{t('home.engine.configure')}</span>
    </button>
  );
};
