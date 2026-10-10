import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

const importStore = async () => {
  const store = await import('./store');
  await store.useStore.persist.rehydrate();
  return store;
};

describe('store persistence hot path', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reuses the persisted projection across transient state updates', async () => {
    const { useStore } = await importStore();
    const partialize = useStore.persist.getOptions().partialize;
    if (!partialize) {
      throw new Error('expected store partialize option');
    }
    const state = useStore.getState();

    const projections = Array.from({ length: 1_000 }, (_, index) =>
      partialize({
        ...state,
        detachedWorkbenchWindows:
          index % 2 === 0
            ? []
            : [{ tabId: 'transient', x: 0, y: 0, width: 10, height: 10, zIndex: 1 }],
        jvmDiagnosticOutputs: {
          [`diagnostic-${index}`]: [],
        },
      }),
    );

    expect(new Set(projections).size).toBe(1);
  });

  it('invalidates the persisted projection when a persisted field changes', async () => {
    const { useStore } = await importStore();
    const partialize = useStore.persist.getOptions().partialize;
    if (!partialize) {
      throw new Error('expected store partialize option');
    }
    const state = useStore.getState();

    const initial = partialize(state) as Partial<typeof state>;
    const transientOnly = partialize({
      ...state,
      detachedWorkbenchWindows: [{ tabId: 'transient', x: 0, y: 0, width: 10, height: 10, zIndex: 1 }],
    }) as Partial<typeof state>;
    const changedTheme = partialize({
      ...state,
      theme: state.theme === 'light' ? 'dark' : 'light',
    }) as Partial<typeof state>;

    expect(transientOnly).toBe(initial);
    expect(changedTheme).not.toBe(initial);
    expect(changedTheme.theme).not.toBe(initial.theme);
  });
});

describe('store workbench tabs', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('adds a service-detail tab, activates it, and closes it', async () => {
    const { useStore } = await importStore();
    const tab = {
      id: 'service-detail:wec-ai',
      title: 'WEC AI服务管理平台',
      type: 'service-detail' as const,
      connectionId: '',
      serviceName: 'wec-ai',
    };

    expect(useStore.getState().tabs.some((item) => item.id === tab.id)).toBe(false);
    useStore.getState().addTab(tab);
    expect(useStore.getState().tabs.some((item) => item.id === tab.id)).toBe(true);
    expect(useStore.getState().activeTabId).toBe(tab.id);

    useStore.getState().closeTab(tab.id);
    expect(useStore.getState().tabs.some((item) => item.id === tab.id)).toBe(false);
  });

  it('moves a tab before its drop target', async () => {
    const { useStore } = await importStore();
    const makeTab = (id: string) => ({
      id,
      title: id,
      type: 'service-detail' as const,
      connectionId: '',
      serviceName: id,
    });
    useStore.getState().addTab(makeTab('svc-a'));
    useStore.getState().addTab(makeTab('svc-b'));
    useStore.getState().addTab(makeTab('svc-c'));

    useStore.getState().moveTab('svc-c', 'svc-a');
    expect(useStore.getState().tabs.map((tab) => tab.id)).toEqual(['svc-c', 'svc-a', 'svc-b']);
  });
});

describe('store appearance persistence', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('persists surviving appearance settings through setAppearance', async () => {
    const { useStore } = await importStore();
    useStore.getState().setAppearance({
      tabDisplay: {
        layout: 'double',
        primaryElements: ['object', 'kind'],
        secondaryElements: ['kind'],
      },
    });

    const appearance = useStore.getState().appearance;
    expect(appearance.tabDisplay.layout).toBe('double');
    expect(appearance.tabDisplay.primaryElements).toEqual(['object', 'kind']);
  });

  it('keeps theme and font size as first-class persisted fields', async () => {
    const { useStore } = await importStore();
    useStore.getState().setTheme('dark');
    useStore.getState().setFontSize(18);

    expect(useStore.getState().theme).toBe('dark');
    expect(useStore.getState().fontSize).toBe(18);
  });
});
