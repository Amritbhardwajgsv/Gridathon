"use client";

import { useEffect, useRef } from "react";

export default function ProgressBar({
  value,
  max = 100,
  colorClass = "bg-[#e8a034]",
  trackClass = "bg-[#252b35]",
  heightClass = "h-1.5",
}: {
  value: number;
  max?: number;
  colorClass?: string;
  trackClass?: string;
  heightClass?: string;
}) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fillRef.current) {
      const pct = Math.min(100, Math.max(0, (value / max) * 100));
      fillRef.current.style.width = `${pct}%`;
    }
  }, [value, max]);

  return (
    <div className={`w-full overflow-hidden rounded ${trackClass} ${heightClass}`}>
      <div ref={fillRef} className={`${heightClass} rounded ${colorClass} transition-[width] duration-300`} />
    </div>
  );
}
