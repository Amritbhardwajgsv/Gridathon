import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  body: string;
}

export default function EmptyState({ body, title }: EmptyStateProps) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-ink-50 text-ink-300">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="text-base font-semibold text-ink-950">{title}</div>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-500">{body}</p>
    </div>
  );
}
