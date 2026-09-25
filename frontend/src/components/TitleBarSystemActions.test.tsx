import React from 'react';
import { create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import TitleBarSystemActions from './TitleBarSystemActions';

vi.mock('antd', () => ({
  Button: ({ icon, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) => (
    <button {...props}>{icon}</button>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@ant-design/icons', () => ({
  SettingOutlined: () => <span data-icon="settings" />,
}));

describe('TitleBarSystemActions', () => {
  it('keeps the settings action usable', () => {
    const onOpenSettings = vi.fn();
    const renderer = create(
      <TitleBarSystemActions
        settingsLabel="Settings"
        onOpenSettings={onOpenSettings}
      />,
    );

    const toolbar = renderer.root.findByProps({ 'data-titlebar-system-actions': 'true' });
    const buttons = toolbar.findAllByType('button');

    expect(toolbar.props['data-no-titlebar-toggle']).toBe('true');
    expect(buttons.map((button) => button.props['aria-label'])).toEqual(['Settings']);
    expect(buttons[0].props['data-sidebar-settings-action']).toBe('true');
    expect(buttons[0].props['data-titlebar-settings-action']).toBe('true');

    buttons[0].props.onClick();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
