import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, Empty, Input, List, Modal, Tooltip } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
  InboxOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useI18n } from '../../i18n/provider';
import { useServiceRegistryStore } from '../../serviceRegistryStore';
import { resolveServiceTemplate } from './serviceTreeModel';
import './serviceTreeSidebar.css';

export const UNGROUPED_KEY = '__ungrouped__';

/**
 * 「管理分组」弹框（面向纳管服务，双栏）：
 * 左栏 = 未分组 + 分组列表（计数、新建、重命名、删除）；
 * 右栏 = 选中分组下的纳管服务列表，可在分组间移动。
 */
export const ManageServiceGroupsModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { t } = useI18n();
  const groups = useServiceRegistryStore((state) => state.groups);
  const services = useServiceRegistryStore((state) => state.services);
  const addGroup = useServiceRegistryStore((state) => state.addGroup);
  const renameGroup = useServiceRegistryStore((state) => state.renameGroup);
  const removeGroup = useServiceRegistryStore((state) => state.removeGroup);
  const moveServiceToGroup = useServiceRegistryStore((state) => state.moveServiceToGroup);

  const [draftName, setDraftName] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>(UNGROUPED_KEY);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    if (!open) {
      setDraftName('');
      setRenamingId(null);
      setRenameDraft('');
      setSelectedKey(UNGROUPED_KEY);
    }
  }, [open]);

  const ungroupedServices = useMemo(
    () => services.filter((item) => item.groupId === null || !groups.some((group) => group.id === item.groupId)),
    [services, groups],
  );
  const selectedServices = useMemo(
    () => (selectedKey === UNGROUPED_KEY
      ? ungroupedServices
      : services.filter((item) => item.groupId === selectedKey)),
    [selectedKey, services, ungroupedServices],
  );
  const selectedIsGroup = selectedKey !== UNGROUPED_KEY;
  const selectedGroup = groups.find((group) => group.id === selectedKey) ?? null;
  const selectedName = selectedIsGroup
    ? (selectedGroup?.name ?? '')
    : t('service.tree.groups.ungrouped');

  const submitCreate = () => {
    const name = draftName.trim();
    if (!name) return;
    const group = addGroup(name);
    setSelectedKey(group.id);
    setDraftName('');
  };

  const submitRename = () => {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (name) {
      renameGroup(renamingId, name);
    }
    setRenamingId(null);
  };

  const confirmDeleteGroup = (groupId: string, name: string) => {
    Modal.confirm({
      title: t('service.tree.group.deleteTitle'),
      content: t('service.tree.group.delete_confirm', { name }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => {
        removeGroup(groupId);
        setSelectedKey(UNGROUPED_KEY);
      },
    });
  };

  const groupRowActions = (groupId: string, name: string): React.ReactNode => (
    renamingId === groupId ? [
      <Tooltip key="save" title={t('common.ok')}>
        <Button type="text" size="small" icon={<CheckOutlined />} onClick={submitRename} />
      </Tooltip>,
      <Tooltip key="cancel" title={t('common.cancel')}>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setRenamingId(null)} />
      </Tooltip>,
    ] : [
      <Tooltip key="rename" title={t('service.tree.menu.rename')}>
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            setRenamingId(groupId);
            setRenameDraft(name);
          }}
        />
      </Tooltip>,
      <Tooltip key="delete" title={t('service.tree.menu.deleteGroup')}>
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            confirmDeleteGroup(groupId, name);
          }}
        />
      </Tooltip>,
    ]
  );

  const moveMenu = (serviceName: string, currentGroupId: string | null): React.ReactNode => (
    <Dropdown
      menu={{
        items: [
          ...(currentGroupId !== null ? [{
            key: UNGROUPED_KEY,
            label: t('service.tree.groups.ungrouped'),
          }] : []),
          ...groups
            .filter((group) => group.id !== currentGroupId)
            .map((group) => ({ key: group.id, label: group.name })),
        ],
        onClick: ({ key }: { key: string }) => {
          moveServiceToGroup(serviceName, key === UNGROUPED_KEY ? null : key);
        },
      }}
      trigger={['click']}
    >
      <Button type="text" size="small" icon={<SwapOutlined />}>
        {t('service.tree.groups.move')}
      </Button>
    </Dropdown>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('service.tree.groups.manage_title')}
      footer={null}
      width={860}
      centered
      destroyOnHidden
      wrapClassName="gst-groups-modal"
    >
      <div className="gst-manage-layout" data-service-groups-manage="true">
        <aside className="gst-manage-side">
          <div className="gst-groups-create">
            <Input
              value={draftName}
              placeholder={t('service.tree.group.name.placeholder')}
              maxLength={40}
              onChange={(event) => setDraftName(event.target.value)}
              onPressEnter={submitCreate}
            />
            <Button type="primary" icon={<PlusOutlined />} disabled={!draftName.trim()} onClick={submitCreate}>
              {t('service.tree.groups.create')}
            </Button>
          </div>

          <div
            className={`gst-side-row${selectedKey === UNGROUPED_KEY ? ' is-selected' : ''}`}
            data-service-side-row="ungrouped"
            onClick={() => setSelectedKey(UNGROUPED_KEY)}
          >
            <span className="gst-side-row-icon"><InboxOutlined /></span>
            <span className="gst-side-row-name">{t('service.tree.groups.ungrouped')}</span>
            <span className="gst-groups-row-count">{ungroupedServices.length}</span>
          </div>

          {groups.map((group) => (
            <div
              key={group.id}
              className={`gst-side-row${selectedKey === group.id ? ' is-selected' : ''}`}
              data-service-side-row={group.id}
              onClick={() => setSelectedKey(group.id)}
            >
              {renamingId === group.id ? (
                <Input
                  size="small"
                  value={renameDraft}
                  maxLength={40}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onPressEnter={submitRename}
                  onBlur={submitRename}
                />
              ) : (
                <React.Fragment>
                  <span className="gst-side-row-name">{group.name}</span>
                  <span className="gst-groups-row-count">
                    {services.filter((item) => item.groupId === group.id).length}
                  </span>
                </React.Fragment>
              )}
              <span className="gst-side-row-actions" onClick={(event) => event.stopPropagation()}>
                {groupRowActions(group.id, group.name)}
              </span>
            </div>
          ))}

          {groups.length === 0 && (
            <div className="gst-groups-empty-line">{t('service.tree.groups.empty')}</div>
          )}
        </aside>

        <section className="gst-manage-main">
          <div className="gst-manage-main-head">
            <span className="gst-manage-title">{selectedName}</span>
            <span className="gst-groups-row-count">
              {t('service.tree.groups.count', { count: selectedServices.length })}
            </span>
          </div>

          {selectedServices.length === 0 ? (
            <Empty
              className="gst-groups-empty"
              description={t('service.tree.groups.no_services')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              className="gst-service-rows"
              dataSource={selectedServices}
              rowKey={(service: { name: string }) => service.name}
              renderItem={(service: {
                name: string; serviceType: string; displayName?: string; addedAt: string; groupId: string | null;
              }) => {
                const template = resolveServiceTemplate(service.serviceType);
                return (
                  <List.Item
                    className="gst-service-row"
                    data-service-manage-row={service.name}
                    actions={[moveMenu(service.name, service.groupId)]}
                  >
                    <div className="gst-service-row-main">
                      {template
                        ? <img className="gst-service-icon" src={template.iconSrc} alt="" />
                        : <span className="gst-service-icon-fallback">◆</span>}
                      <span className="gst-service-row-name">
                        {service.displayName?.trim() || service.name}
                      </span>
                      <span className="gst-service-row-scm">{service.name}</span>
                      <span className="gst-service-row-time">
                        {service.addedAt ? dayjs(service.addedAt).format('YYYY-MM-DD HH:mm') : ''}
                      </span>
                    </div>
                  </List.Item>
                );
              }}
            />
          )}
        </section>
      </div>
    </Modal>
  );
};
