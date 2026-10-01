/** @vitest-environment jsdom */
import React from 'react';
import { create, act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeState = vi.hoisted(() => ({
  services: [] as Array<Record<string, unknown>>,
  groups: [] as Array<Record<string, unknown>>,
  serviceStates: {} as Record<string, string>,
  removeService: vi.fn(),
  moveServiceToGroup: vi.fn(),
  removeGroup: vi.fn(),
  renameGroup: vi.fn(),
}));

const onAddService = vi.fn();

vi.mock('../../i18n/provider', () => ({
  useI18n: () => ({
    language: 'zh-CN',
    preference: 'zh-CN',
    setPreference: vi.fn(),
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && 'count' in params) return `${key}:${params.count}`;
      if (params && 'name' in params) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock('../../serviceRegistryStore', () => ({
  useServiceRegistryStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return { ...actual, createPortal: (children: React.ReactNode) => children };
});

vi.mock('antd', async () => {
  const React = await import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  // antd 的 Input 会吃 allowClear / prefix 这类非 DOM 属性，mock 里先剥掉再落到原生 input。
  // 这里必须把 props 标成带 allowClear 的形状，否则解构不存在的属性直接是类型错误。
  type MockInputProps = React.InputHTMLAttributes<HTMLInputElement> & { allowClear?: boolean };
  const Input = React.forwardRef<HTMLInputElement, MockInputProps>(
    function MockInput(props, ref) {
      React.useImperativeHandle(ref, () => ({ input: { focus: () => {}, select: () => {} } }) as never);
      const { allowClear: _allowClear, prefix: _prefix, ...rest } = props;
      return <input {...rest} />;
    },
  );
  const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  );
  return {
    Button,
    Empty: ({ description }: { description?: React.ReactNode }) => <div data-mock-empty>{description}</div>,
    Input,
    Modal: Object.assign(
      ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <>{children}</> : null),
      { confirm: vi.fn() },
    ),
    Tooltip: passthrough,
    List: ({ dataSource, renderItem }: { dataSource?: unknown[]; renderItem?: (item: unknown) => React.ReactNode }) => (
      <>{(dataSource ?? []).map((item, index) => <React.Fragment key={index}>{renderItem?.(item)}</React.Fragment>)}</>
    ),
    Tree: ({ treeData, titleRender }: { treeData?: Record<string, unknown>[]; titleRender?: (node: Record<string, unknown>) => React.ReactNode }) => {
      const renderNode = (node: Record<string, unknown>): React.ReactNode => (
        <div key={String(node.key)} data-mock-tree-node={String(node.key)}>
          {titleRender ? titleRender(node) : String(node.title)}
          {(node.children as Record<string, unknown>[] | undefined ?? []).map(renderNode)}
        </div>
      );
      return <div data-mock-tree="true">{(treeData ?? []).map(renderNode)}</div>;
    },
  };
});

import { ServiceTreeSidebar } from './ServiceTreeSidebar';
import { ServiceTreeContextMenu } from './ServiceTreeContextMenu';

const nginxService = {
  name: 'nginx-core',
  serviceType: 'nginx',
  displayName: '核心网关',
  mode: 'manage',
  programFile: 'C:/nginx/nginx.exe',
  addedAt: 't',
  groupId: 'g1',
};
const mysqlService = {
  name: 'mysql-local',
  serviceType: 'mysql',
  displayName: '本地数据库',
  mode: 'manage',
  programFile: 'C:/mysql/mysqld.exe',
  addedAt: 't',
  groupId: null,
};

function findAllByProp(root: ReactTestInstance, prop: string): ReactTestInstance[] {
  return root.findAll((node) => node.props?.[prop] !== undefined);
}

describe('ServiceTreeSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.services = [];
    storeState.groups = [];
  });

  it('无服务时渲染空态，点击添加按钮回调 onAddService', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ServiceTreeSidebar onAddService={onAddService} />);
    });
    expect(findAllByProp(renderer.root, 'data-service-tree-empty')).toHaveLength(1);

    const addButtons = findAllByProp(renderer.root, 'data-service-tree-add-action');
    // antd Button 会把 data-* 透传给原生 button，组件与 DOM 节点各匹配一次
    expect(addButtons.length).toBeGreaterThan(0);
    await act(async () => {
      addButtons[addButtons.length - 1].props.onClick();
    });
    expect(onAddService).toHaveBeenCalledTimes(1);
  });

  it('渲染分组与服务节点', async () => {
    storeState.groups = [{ id: 'g1', name: '后台服务', createdAt: 't' }];
    storeState.services = [nginxService, mysqlService];
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ServiceTreeSidebar onAddService={onAddService} />);
    });
    expect(findAllByProp(renderer.root, 'data-service-tree-group-title')).toHaveLength(1);
    expect(findAllByProp(renderer.root, 'data-service-tree-service-title')).toHaveLength(2);
    expect(findAllByProp(renderer.root, 'data-service-tree-empty')).toHaveLength(0);
  });

  it('搜索过滤后只保留匹配服务', async () => {
    storeState.services = [nginxService, mysqlService];
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ServiceTreeSidebar onAddService={onAddService} />);
    });
    const input = renderer.root.find(
      (node) => node.type === 'input' && node.props?.placeholder === 'service.tree.search.placeholder',
    );
    await act(async () => {
      input.props.onChange({ target: { value: '网关' } });
    });
    const titles = findAllByProp(renderer.root, 'data-service-tree-service-title');
    expect(titles).toHaveLength(1);
  });
});

describe('ServiceTreeContextMenu', () => {
  it('服务菜单列出分组与移除动作，选择分组触发移动', async () => {
    const onClose = vi.fn();
    const onMoveService = vi.fn();
    const onRemoveService = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ServiceTreeContextMenu
          target={{ kind: 'service', service: nginxService as never }}
          groups={[{ id: 'g1', name: '后台服务', createdAt: 't' }, { id: 'g2', name: '网关', createdAt: 't' }]}
          onClose={onClose}
          onMoveService={onMoveService}
          onRemoveService={onRemoveService}
          onRenameGroup={vi.fn()}
          onDeleteGroup={vi.fn()}
        />,
      );
    });
    const items = renderer.root.findAll(
      (node) => node.type === 'button' && typeof node.props?.role === 'string' && node.props.role === 'menuitem',
    );
    const actions = items.map((item) => item.props.onClick);
    expect(items.length).toBeGreaterThanOrEqual(3);

    // 第一个分组项 = move-to-group:g1
    await act(async () => {
      actions[0]({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    });
    expect(onMoveService).toHaveBeenCalledWith('nginx-core', 'g1');
    expect(onClose).toHaveBeenCalled();
  });
});
