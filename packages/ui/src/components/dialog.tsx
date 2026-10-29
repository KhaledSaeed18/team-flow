import type { ReactNode } from 'react';
import {
  Dialog as AriaDialog,
  type DialogProps,
  Heading,
  Modal,
  ModalOverlay,
  type ModalOverlayProps,
} from 'react-aria-components';

export { DialogTrigger } from 'react-aria-components';

const overlay =
  'fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-[12vh] data-[entering]:animate-fade-in data-[exiting]:animate-fade-out';

export interface DialogShellProps extends Omit<ModalOverlayProps, 'children'> {
  title: string;
  description?: ReactNode;
  children: DialogProps['children'];
  width?: 'sm' | 'md' | 'lg';
}

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

/** A modal dialog with a title. Escape and outside clicks dismiss it; focus is trapped and restored. */
export function Dialog({ title, description, children, width = 'md', ...props }: DialogShellProps) {
  return (
    <ModalOverlay {...props} isDismissable className={overlay}>
      <Modal
        className={`w-full ${widths[width]} rounded-lane border border-line bg-surface shadow-lifted`}
      >
        <AriaDialog className="outline-none">
          {(renderProps) => (
            <div className="p-5">
              <Heading slot="title" className="font-semibold text-base">
                {title}
              </Heading>
              {description && <p className="mt-1 text-ink-muted text-sm">{description}</p>}
              <div className="mt-4">
                {typeof children === 'function' ? children(renderProps) : children}
              </div>
            </div>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
