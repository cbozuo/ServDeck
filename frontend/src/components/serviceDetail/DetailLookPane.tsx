import React, { useEffect, useState } from 'react';
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

const lookOf = (entry: ManagedServiceEntry): ServiceLook => ({
  mode: entry.iconDataUrl ? 'custom' : 'type',
  color: entry.accentColor || '',
  customIcon: entry.iconDataUrl,
});

export interface DetailLookPaneProps {
  entry: ManagedServiceEntry;
  /** 外观改动写回纳管记录（图标 / 主色），由宿主经 store 持久化 */
  onApply: (next: { iconDataUrl?: string; accentColor?: string }) => void;
}

/**
 * 详情页「外观」页签：功能与样式复用添加服务弹框的外观页签（图标类型/自定义 + 色板 + 预览卡）。
 * 数据流是「本地草稿 + 显式提交」：页签切换（type/custom）只改本地草稿——纯受控会把
 * mode='custom' 立刻写回 registry，iconDataUrl 仍为 undefined 时下一帧又算回 'type'，
 * 切换永远弹回（用户反馈「自定义没生效」）。上传/选候选/选色时才持久化。
 * 「重置为默认」= 类型图标 + 跟随主题（color 清空，与添加弹框 DEFAULT_SERVICE_LOOK 同值）。
 */
export const DetailLookPane: React.FC<DetailLookPaneProps> = ({ entry, onApply }) => {
  const { t } = useI18n();
  const template = templateOf(entry.serviceType);
  const [look, setLook] = useState<ServiceLook>(() => lookOf(entry));

  // 换服务（组件复用）或纳管记录被外部更新时，重置草稿为纳管记录现值
  useEffect(() => {
    setLook(lookOf(entry));
  }, [entry.name, entry.iconDataUrl, entry.accentColor]);

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
            setLook(next);
            if (next.mode === 'custom' && !next.customIcon) {
              // 仅切到「自定义」页（还未上传/选候选）：保持本地态即可，
              // 写回 undefined 会立刻弹回「类型图标」
              return;
            }
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
