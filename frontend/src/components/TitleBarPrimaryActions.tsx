import React from 'react';

interface TitleBarPrimaryActionsProps {
  addServiceLabel?: string;
  onAddService?: () => void;
  connectionGroupLabel?: string;
  onConnectionGroupManagement?: () => void;
  dataRootLabel?: string;
  onDataRoot?: () => void;
}

interface TextActionSpec {
  key: string;
  label: string;
  attr: string;
  onClick: () => void;
}

/**
 * 标题栏主操作区：三个纯文字按钮（新增服务 / 管理分组 / 数据目录）。
 * 2026-10-08 由图标按钮改为文字按钮——图标语义不可读，文字自解释且不需要 Tooltip。
 * 样式复用 .gonavi-titlebar-primary-action（与新建查询/连接文字按钮同一套 ghost 处理）。
 */
const TitleBarPrimaryActions: React.FC<TitleBarPrimaryActionsProps> = ({
  addServiceLabel,
  onAddService,
  connectionGroupLabel,
  onConnectionGroupManagement,
  dataRootLabel,
  onDataRoot,
}) => {
  const textActions: TextActionSpec[] = [];
  if (addServiceLabel && onAddService) {
    textActions.push({
      key: 'add-service',
      label: addServiceLabel,
      attr: 'add-service',
      onClick: onAddService,
    });
  }
  if (connectionGroupLabel && onConnectionGroupManagement) {
    textActions.push({
      key: 'connection-group',
      label: connectionGroupLabel,
      attr: 'connection-group',
      onClick: onConnectionGroupManagement,
    });
  }
  if (dataRootLabel && onDataRoot) {
    textActions.push({
      key: 'data-root',
      label: dataRootLabel,
      attr: 'data-root',
      onClick: onDataRoot,
    });
  }

  return (
    <div
      className="gonavi-titlebar-primary-actions"
      data-titlebar-primary-actions="true"
      data-no-titlebar-toggle="true"
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {textActions.map(({ key, label, attr, onClick }) => (
        <button
          key={key}
          type="button"
          className="gonavi-titlebar-primary-action"
          aria-label={label}
          data-gonavi-titlebar-action={attr}
          onClick={onClick}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default TitleBarPrimaryActions;
