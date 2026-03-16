import type { ReactNode } from "react";

interface AssignmentCardProps {
  title: string;
  subtitle: string;
  state: "normal" | "urgent" | "overdue" | "active" | "completed" | "missed";
  children?: ReactNode;
  actions?: ReactNode;
}

const stateClassMap: Record<AssignmentCardProps["state"], string> = {
  normal: "border-slate-200 bg-white",
  urgent: "border-amber-300 bg-amber-50",
  overdue: "border-rose-300 bg-rose-50",
  active: "border-teal-300 bg-teal-50 shadow-glow",
  completed: "border-emerald-200 bg-emerald-50",
  missed: "border-orange-300 bg-orange-50"
};

export const AssignmentCard = ({ title, subtitle, state, children, actions }: AssignmentCardProps) => {
  return (
    <article className={`rounded-2xl border p-4 transition ${stateClassMap[state]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children ? <div className="mt-3 space-y-2 text-sm text-slate-700">{children}</div> : null}
    </article>
  );
};
