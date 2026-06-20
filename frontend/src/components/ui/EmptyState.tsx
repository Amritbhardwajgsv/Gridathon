import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  body: string;
}

export default function EmptyState({ body, title }: EmptyStateProps) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="browser-card inline-block p-5">
        <Inbox className="h-6 w-6 text-[#444455]" />
      </div>
      <div className="mt-5 text-[14px] font-black uppercase tracking-[0.04em] text-[#F0F0F8]">{title}</div>
      <p className="mt-2 max-w-md text-[13px] leading-6 text-[#8888A0]">{body}</p>
    </div>
  );
}
