import type { ReactNode } from "react";

interface FieldProps {
  children: ReactNode;
  error?: string;
  hint?: string;
  label: string;
  required?: boolean;
}

export const fieldClassName =
  "mt-1.5 w-full rounded border-2 border-[#252535] bg-[#08080F] px-3 py-2.5 text-[13px] text-[#F0F0F8] outline-none transition placeholder:text-[#444455] focus:border-[#FFE600] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(255,230,0,0.10)]";

export default function Field({ children, error, hint, label, required }: FieldProps) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#8888A0]">
      <span className="flex items-center justify-between gap-2">
        <span>
          {label}
          {required ? <span className="ml-1 text-[#FFE600]">*</span> : null}
        </span>
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-[11px] font-normal tracking-normal text-[#444455]">{hint}</span> : null}
      {error ? <span className="mt-1 block text-[11px] font-normal tracking-normal text-[#EF4444]">{error}</span> : null}
    </label>
  );
}
