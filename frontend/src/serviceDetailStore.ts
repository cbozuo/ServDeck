import { create } from 'zustand';
import { useStore } from './store';
import { buildServiceDetailTab, buildServiceDetailTabId } from './utils/serviceDetailTab';

interface ServiceDetailState {
  /** 当前在详情 tab 的服务名；null = 未打开。仅作状态记录，呈现走 service-detail tab。 */
  openName: string | null;
  /** 侧栏树单击与首页行内「更多」共用：打开（或聚焦）该服务的详情 tab。 */
  open: (name: string) => void;
  /** 关闭当前记录的详情 tab（存在时）。 */
  close: () => void;
}

/** 服务详情以 workbench tab 呈现（2026-09-30 起从主区替换形态迁移），
 *  与设置中心一致支持拖出为浮层窗口。 */
export const useServiceDetailStore = create<ServiceDetailState>((set, get) => ({
  openName: null,
  open: (name) => {
    set({ openName: name });
    useStore.getState().addTab(buildServiceDetailTab(name));
  },
  close: () => {
    const name = get().openName;
    if (!name) return;
    const tabId = buildServiceDetailTabId(name);
    const { tabs, closeTab } = useStore.getState();
    if (tabs.some((tab) => tab.id === tabId)) {
      closeTab(tabId);
    }
    set({ openName: null });
  },
}));
