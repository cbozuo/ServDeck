import { create } from 'zustand';

interface ServiceDetailState {
  /** 当前在详情页的服务名；null = 未打开（主区显示 tabs 或首页） */
  openName: string | null;
  open: (name: string) => void;
  close: () => void;
}

/** 服务详情页的打开状态：侧栏树单击与首页行内「更多」共用；主区替换呈现。 */
export const useServiceDetailStore = create<ServiceDetailState>((set) => ({
  openName: null,
  open: (name) => set({ openName: name }),
  close: () => set({ openName: null }),
}));
