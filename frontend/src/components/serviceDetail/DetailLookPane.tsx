import React from 'react';
import { InfoCircleFilled } from '@ant-design/icons';
import { useI18n } from '../../i18n/provider';
import {
  AddServiceLookPane,
  type ServiceLook,
} from '../../addService/AddServicePanes';
import { SERVICE_TEMPLATES, type ServiceTemplate } from '../../addService/serviceTemplates';
import type { ManagedServiceEntry } from '../../serviceRegistryStore';

const templateOf = (serviceType: string): ServiceTemplate | undefined =>
  (SERVICE_TEMPLATES as Record<string, ServiceTemplate | undefined>)[serviceType];

export interface DetailLookPaneProps {
  entry: ManagedServiceEntry;
  /** 外观改动写回纳管记录（图标 / 主色），由宿主经 store 持久化 */
  onApply: (next: { iconDataUrl?: string; accentColor?: string }) => void;
}

/**
 * 详情页「外观」页签：功能与样式复用添加服务弹框的外观页签（图标类型/自定义 + 色板 + 预览卡）。
 * 差异只有数据源：读写对象是纳管记录的 iconDataUrl / accentColor，而不是添加时的临时选择；
 * 「重置为默认」= 类型图标 + 跟随主题（color 清空，与添加弹框 DEFAULT_SERVICE_LOOK 同值）。
 */
export const DetailLookPane: React.FC<DetailLookPaneProps> = ({ entry, onApply }) => {
  const { t } = useI18n();
  const template = templateOf(entry.serviceType);

  if (!template) {
    return (
      <div className="dtl-pane">
        <div className="dtl-empty">
          <InfoCircleFilled className="dtl-empty-ico" />
          <h4>{t('detail.tab.look')}</h4>
          <p>{t('detail.deploy.emptyBody')}</p>
        </div>
      </div>
    );
  }

  const look: ServiceLook = {
    mode: entry.iconDataUrl ? 'custom' : 'type',
    color: entry.accentColor || '',
    customIcon: entry.iconDataUrl,
  };

  return (
    <div className="dtl-pane">
      <div className="dtl-panel">
        <div className="dtl-panel-head">
          <span>{t('detail.tab.look')}</span>
        </div>
        <AddServiceLookPane
          template={template}
          value={look}
          onChange={(next) => {
            onApply({
              iconDataUrl: next.mode === 'custom' ? next.customIcon : undefined,
              accentColor: next.color || undefined,
            });
          }}
        />
      </div>
    </div>
  );
};
