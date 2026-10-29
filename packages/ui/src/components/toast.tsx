import { X } from '@phosphor-icons/react';
import {
  Button,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';

export interface ToastMessage {
  title: string;
  description?: string;
  tone?: 'default' | 'danger';
}

/** App-wide toast queue. Toasts are announced to screen readers and reachable with F6. */
export const toasts = new ToastQueue<ToastMessage>({ maxVisibleToasts: 4 });

export const toast = (message: ToastMessage, timeout = 5000) => toasts.add(message, { timeout });

export function Toaster() {
  return (
    <ToastRegion
      queue={toasts}
      className="fixed right-4 bottom-4 z-[60] flex flex-col-reverse gap-2 outline-none"
    >
      {({ toast }) => (
        <Toast
          toast={toast}
          className="focus-ring flex w-80 items-start gap-3 rounded-card border border-line bg-surface p-3 shadow-lifted data-[entering]:animate-slide-in"
        >
          <ToastContent className="flex min-w-0 flex-1 flex-col">
            <Text
              slot="title"
              className={`font-medium text-sm ${toast.content.tone === 'danger' ? 'text-danger' : ''}`}
            >
              {toast.content.title}
            </Text>
            {toast.content.description && (
              <Text slot="description" className="mt-0.5 text-ink-muted text-xs">
                {toast.content.description}
              </Text>
            )}
          </ToastContent>
          <Button
            slot="close"
            aria-label="Dismiss"
            className="focus-ring rounded-[4px] p-0.5 text-ink-faint data-[hovered]:text-ink"
          >
            <X />
          </Button>
        </Toast>
      )}
    </ToastRegion>
  );
}
