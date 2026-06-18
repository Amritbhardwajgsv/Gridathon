import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export default function PageHeader({
  actions,
  description,
  eyebrow,
  title
}: PageHeaderProps) {
  return (
    <section className="bg-ink-950 px-5 py-8 text-white md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
            {eyebrow}
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-100">
            {description}
          </p>
        </div>
        {actions}
      </div>
    </section>
  );
}
