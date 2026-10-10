import React from 'react';
import { Spin } from 'antd';
import type { TabData } from '../types';
import { useWorkbenchTabActivation } from './useWorkbenchTabActivation';
import '../styles/v2-theme-workbench.css';

const JVMOverview = React.lazy(() => import('./JVMOverview'));
const JVMResourceBrowser = React.lazy(() => import('./JVMResourceBrowser'));
const JVMAuditViewer = React.lazy(() => import('./JVMAuditViewer'));
const JVMDiagnosticConsole = React.lazy(() => import('./JVMDiagnosticConsole'));
const JVMMonitoringDashboard = React.lazy(() => import('./JVMMonitoringDashboard'));
const SettingsCenterWorkbench = React.lazy(() => import('./settings/SettingsCenterWorkbench'));
const ServiceDetailWorkbench = React.lazy(
  () => import('./serviceDetail/ServiceDetail') as Promise<{ default: React.ComponentType<{ name: string }> }>,
);
const ServiceHomeWorkbench = React.lazy(
  async () => {
    const mod = await import('./home/ServiceHome');
    return { default: mod.ServiceHome as React.ComponentType };
  },
);

export const WORKBENCH_CONTENT_READY_FALLBACK_MS = 4_000;
const WORKBENCH_PENDING_CONTENT_SELECTOR = '[data-monaco-editor-loading="true"]';

export const waitForWorkbenchContentReady = (
  onReady: () => void,
  root: Pick<Document, 'querySelector'> = document,
): (() => void) => {
  let settled = false;
  let observer: MutationObserver | null = null;
  const finish = () => {
    if (settled) return;
    settled = true;
    observer?.disconnect();
    clearTimeout(fallbackTimer);
    onReady();
  };
  const check = () => {
    if (!root.querySelector(WORKBENCH_PENDING_CONTENT_SELECTOR)) finish();
  };
  const fallbackTimer = setTimeout(finish, WORKBENCH_CONTENT_READY_FALLBACK_MS);
  check();
  if (!settled && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    check();
  }
  return () => {
    settled = true;
    observer?.disconnect();
    clearTimeout(fallbackTimer);
  };
};

const WorkbenchContentReady: React.FC<{
  marker: string;
  onReady?: () => void;
}> = ({ onReady }) => {
  React.useEffect(() => {
    if (!onReady) return undefined;
    return waitForWorkbenchContentReady(onReady);
  }, [onReady]);
  return null;
};

export interface WorkbenchTabContentProps {
  tab: TabData;
  isActive?: boolean;
  onContentReady?: () => void;
  onRequestClose?: () => void;
}

export const WorkbenchTabContent: React.FC<WorkbenchTabContentProps> = React.memo(({
  tab,
  isActive: isActiveProp,
  onContentReady,
  onRequestClose,
}) => {
  const isActive = useWorkbenchTabActivation(tab.id, isActiveProp);
  let content: React.ReactNode;
  if (tab.type === 'settings-center') {
    content = <SettingsCenterWorkbench tab={tab} isActive={isActive} />;
  } else if (tab.type === 'service-home') {
    content = <ServiceHomeWorkbench />;
  } else if (tab.type === 'service-detail') {
    content = <ServiceDetailWorkbench name={tab.serviceName ?? ''} />;
  } else if (tab.type === 'jvm-overview') {
    content = <JVMOverview tab={tab} />;
  } else if (tab.type === 'jvm-resource') {
    content = <JVMResourceBrowser tab={tab} />;
  } else if (tab.type === 'jvm-audit') {
    content = <JVMAuditViewer tab={tab} />;
  } else if (tab.type === 'jvm-diagnostic') {
    content = <JVMDiagnosticConsole tab={tab} />;
  } else if (tab.type === 'jvm-monitoring') {
    content = <JVMMonitoringDashboard tab={tab} />;
  } else {
    const exhaustiveType: never = tab.type;
    return exhaustiveType;
  }

  return (
    <React.Suspense
      fallback={(
        <div
          aria-busy="true"
          style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, display: 'grid', placeItems: 'center' }}
        >
          <Spin size="small" />
        </div>
      )}
    >
      {content}
      <WorkbenchContentReady
        key={`${tab.id}:${tab.type}`}
        marker={`${tab.id}:${tab.type}`}
        onReady={onContentReady}
      />
    </React.Suspense>
  );
});

WorkbenchTabContent.displayName = 'WorkbenchTabContent';

export default WorkbenchTabContent;
