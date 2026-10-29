import { CaretUpDown, Check, Moon, SignOut, Sun } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Avatar, Menu, MenuItem, MenuSeparator, MenuTrigger } from '@teamflow/ui';
import { Button } from 'react-aria-components';
import { authClient } from '../../lib/auth.ts';
import type { Me } from '../../lib/session.ts';
import { resetSession } from '../../lib/session.ts';
import { setTheme, useTheme } from '../../lib/theme.ts';

export function WorkspaceMenu({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const navigate = useNavigate();
  const active = me.organizations.find((o) => o.id === me.activeOrganizationId);

  const switchTo = async (organizationId: string) => {
    if (organizationId === me.activeOrganizationId) return;
    await authClient.organization.setActive({ organizationId });
    resetSession(queryClient);
    window.location.assign('/');
  };

  const signOut = async () => {
    await authClient.signOut();
    resetSession(queryClient);
    window.location.assign('/sign-in');
  };

  return (
    <MenuTrigger>
      <Button className="focus-ring flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left data-[hovered]:bg-lane">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-[5px] bg-ink font-semibold text-2xs text-canvas">
          {active?.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="flex-1 truncate font-semibold text-sm">{active?.name}</span>
        <CaretUpDown aria-hidden className="text-ink-faint" />
      </Button>
      <Menu placement="bottom start">
        {me.organizations.map((org) => (
          <MenuItem
            key={org.id}
            textValue={org.name}
            onAction={() => switchTo(org.id)}
            icon={org.id === me.activeOrganizationId ? <Check /> : null}
          >
            {org.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          icon={theme === 'dark' ? <Sun /> : <Moon />}
          onAction={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          textValue="Account settings"
          onAction={() => navigate({ to: '/settings/account' })}
        >
          <span className="flex items-center gap-2">
            <Avatar name={me.user.name} src={me.user.image} size="xs" />
            <span className="truncate text-ink-muted">{me.user.email}</span>
          </span>
        </MenuItem>
        <MenuItem icon={<SignOut />} onAction={signOut}>
          Sign out
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );
}
