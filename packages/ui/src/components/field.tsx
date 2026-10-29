import type { ReactNode } from 'react';
import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
  type ValidationResult,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

export const input = tv({
  base: [
    'focus-ring w-full rounded-control border border-line bg-surface px-2.5 text-sm text-ink',
    'placeholder:text-ink-faint data-[hovered]:border-line-strong',
    'data-[invalid]:border-danger data-[disabled]:opacity-50',
  ],
  variants: { multiline: { true: 'min-h-20 py-2 leading-relaxed', false: 'h-9' } },
  defaultVariants: { multiline: false },
});

export interface TextFieldProps extends AriaTextFieldProps {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  multiline?: boolean;
}

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  multiline = false,
  className,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      {...props}
      className={`flex flex-col gap-1.5 ${typeof className === 'string' ? className : ''}`}
    >
      {label && <Label className="font-medium text-ink text-sm">{label}</Label>}
      {multiline ? (
        <TextArea placeholder={placeholder} className={input({ multiline: true })} />
      ) : (
        <Input placeholder={placeholder} className={input()} />
      )}
      {description && (
        <Text slot="description" className="text-ink-muted text-xs">
          {description}
        </Text>
      )}
      <FieldError className="text-danger text-xs">{errorMessage}</FieldError>
    </AriaTextField>
  );
}
