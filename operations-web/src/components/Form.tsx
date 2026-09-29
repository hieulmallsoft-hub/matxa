import type { FormEvent, ReactNode } from 'react';

export function csv(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

export function selected(form: HTMLFormElement, name: string) {
  const element = form.elements.namedItem(name);
  if (!element) return [];
  if (element instanceof HTMLSelectElement) {
    return [...element.selectedOptions].map((item) => item.value);
  }
  return [];
}

export function optionalNumber(value: FormDataEntryValue | null) {
  return value === '' || value === null ? undefined : Number(value);
}

export function iso(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value ? new Date(value).toISOString() : undefined;
}

export function FormCard({
  children,
  onSubmit,
  className = 'form-grid',
}: {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
}) {
  return (
    <form className={className} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
