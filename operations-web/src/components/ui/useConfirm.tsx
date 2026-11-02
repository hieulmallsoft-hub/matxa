import React, { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  tone?: 'danger' | 'warning' | 'primary';
}

/**
 * Drop-in replacement for window.confirm using the app's dialog:
 * `if (!(await confirm({ title, message }))) return;` and render `dialog` once.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>(() => undefined);
  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );
  const close = (value: boolean) => {
    resolver.current(value);
    setOptions(null);
  };
  const dialog = (
    <ConfirmDialog
      isOpen={Boolean(options)}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
      title={options?.title ?? ''}
      message={options?.message ?? ''}
      confirmText={options?.confirmText}
      tone={options?.tone ?? 'danger'}
    />
  );
  return { confirm, dialog };
}
