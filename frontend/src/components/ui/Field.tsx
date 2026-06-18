import type { ReactNode } from "react";

interface FieldProps {
  children: ReactNode;
  error?: string;
  hint?: string;
  label: string;
  required?: boolean;
}

export const fieldClassName =
  "mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-pine focus:ring-2 focus:ring-pine/15";

export default function Field({
  children,
  error,
  hint,
  label,
  required
}: FieldProps) {
  return (
    <label className="block text-sm font-medium text-ink-700">
      <span className="flex items-center justify-between gap-2">
        <span>
          {label}
          {required ? <span className="ml-1 text-signal">*</span> : null}
        </span>
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
