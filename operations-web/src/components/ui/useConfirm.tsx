import React, { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  tone?: 'danger' | 'warning' | 'primary';
}

interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  /** Text the field starts with (e.g. the current name when renaming). */
  defaultValue?: string;
  /** The confirm button stays disabled until at least `minLength` (default 3) characters are typed. */
  required?: boolean;
  minLength?: number;
}

/**
 * Drop-in replacement for window.confirm using the app's dialog:
 * `if (!(await confirm({ title, message }))) return;` and render `dialog` once.
 * `prompt` does the same with a text field and resolves the trimmed text, or null when cancelled.
 */
export function useConfirm() {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState('');
  const resolver = useRef<(value: boolean) => void>(() => undefined);
  const open = (next: PromptOptions, withInput: boolean) =>
    new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setText(next.defaultValue ?? '');
      setAsking(withInput);
      setOptions(next);
    });
  const confirm = useCallback((next: ConfirmOptions) => open(next, false), []);
  const textRef = useRef('');
  textRef.current = text;
  const prompt = useCallback(
    async (next: PromptOptions) => ((await open(next, true)) ? textRef.current.trim() : null),
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
      confirmDisabled={asking && Boolean(options?.required) && text.trim().length < (options?.minLength ?? 3)}
    >
      {asking && (
        <textarea
          autoFocus
          rows={3}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={options?.placeholder}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
        />
      )}
    </ConfirmDialog>
  );
  return { confirm, prompt, dialog };
}
