import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export default function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <section className="border-b-2 border-[#252535] bg-[#08080F] px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#FFE600]">
            + {eyebrow}
          </div>
          <h1 className="mt-3 max-w-4xl text-[28px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-[#F0F0F8] md:text-[34px]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#8888A0]">
            {description}
          </p>
        </div>
        {actions}
      </div>
    </section>
  );
}
