import type { ReactNode } from "react";

interface StatusPillProps {
  tone: "normal" | "urgent" | "overdue" | "active" | "completed" | "missed";
  children: ReactNode;
}

const toneClassMap: Record<StatusPillProps["tone"], string> = {
  normal: "bg-slate-100 text-slate-700 border-slate-300",
  urgent: "bg-amber-100 text-amber-800 border-amber-300",
  overdue: "bg-rose-100 text-rose-800 border-rose-300",
  active: "bg-teal-100 text-teal-800 border-teal-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  missed: "bg-orange-100 text-orange-800 border-orange-300"
};

export const StatusPill = ({ tone, children }: StatusPillProps) => {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClassMap[tone]}`}
    >
      {children}
    </span>
  );
};
