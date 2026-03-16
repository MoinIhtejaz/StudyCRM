import { useState } from "react";
import { parseISO } from "date-fns";
import { AssignmentCard } from "../components/AssignmentCard";
import { StatusPill } from "../components/StatusPill";
import { SummaryCards } from "../components/SummaryCards";
import {
  dayOfWeekLabels,
  formatActivationTime,
  formatDateTime,
  isStandardOverdue,
  isStandardUrgent
} from "../lib/dateUtils";
import type { ActiveWeeklyTask, StandardAssignment } from "../types/models";

interface DashboardPageProps {
  now: Date;
  openStandardAssignments: StandardAssignment[];
  activeWeeklyTasks: ActiveWeeklyTask[];
  summaryCards: Array<{
    label: string;
    value: number;
    tone: "neutral" | "urgent" | "overdue" | "active" | "completed";
  }>;
  onCompleteStandard: (assignmentId: string) => Promise<void>;
  onCompleteWeekly: (occurrenceId: string) => Promise<void>;
}

export const DashboardPage = ({
  now,
  openStandardAssignments,
  activeWeeklyTasks,
  summaryCards,
  onCompleteStandard,
  onCompleteWeekly
}: DashboardPageProps) => {
  const [completingStandardId, setCompletingStandardId] = useState<string | null>(null);
  const [completingWeeklyId, setCompletingWeeklyId] = useState<string | null>(null);

  const standardSorted = [...openStandardAssignments].sort(
    (a, b) => +parseISO(a.dueAt) - +parseISO(b.dueAt)
  );

  const triggerStandardComplete = async (assignmentId: string) => {
    if (completingStandardId) {
      return;
    }

    setCompletingStandardId(assignmentId);
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    await onCompleteStandard(assignmentId);
    setCompletingStandardId(null);
  };

  const triggerWeeklyComplete = async (occurrenceId: string) => {
    if (completingWeeklyId) {
      return;
    }

    setCompletingWeeklyId(occurrenceId);
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    await onCompleteWeekly(occurrenceId);
    setCompletingWeeklyId(null);
  };

  return (
    <div className="space-y-6">
      <SummaryCards cards={summaryCards} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Main Dashboard</h2>
          <p className="text-sm text-slate-500">
            Incomplete standards + currently active weekly tasks
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {standardSorted.map((assignment) => {
            const overdue = isStandardOverdue(assignment, now);
            const urgent = isStandardUrgent(assignment, now);
            const isCompleting = completingStandardId === assignment.id;

            return (
              <AssignmentCard
                key={assignment.id}
                title={assignment.title}
                subtitle={`${assignment.unitName} • ${assignment.categoryName || "Uncategorized"}`}
                state={overdue ? "overdue" : urgent ? "urgent" : "normal"}
                actions={
                  <button
                    type="button"
                    onClick={() => void triggerStandardComplete(assignment.id)}
                    disabled={isCompleting}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      isCompleting
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] ${
                        isCompleting ? "bg-white/20 tick-pop" : "bg-emerald-600/10"
                      }`}
                    >
                      {isCompleting ? "✓" : ""}
                    </span>
                    {isCompleting ? "Done" : "Mark done"}
                  </button>
                }
              >
                <p>Due: {formatDateTime(assignment.dueAt)}</p>
                <div className="flex flex-wrap gap-2">
                  {overdue ? <StatusPill tone="overdue">Overdue</StatusPill> : null}
                  {!overdue && urgent ? <StatusPill tone="urgent">Urgent (within 72h)</StatusPill> : null}
                  {!urgent && !overdue ? <StatusPill tone="normal">Open</StatusPill> : null}
                  <StatusPill tone="normal">Status: {assignment.status.replace("_", " ")}</StatusPill>
                </div>
              </AssignmentCard>
            );
          })}

          {activeWeeklyTasks.map((task) => (
            <AssignmentCard
              key={task.occurrence.id}
              title={task.assignment.title}
              subtitle={`${task.assignment.unitName} • ${task.assignment.categoryName || "Uncategorized"}`}
              state="active"
              actions={
                <button
                  type="button"
                  onClick={() => void triggerWeeklyComplete(task.occurrence.id)}
                  disabled={completingWeeklyId === task.occurrence.id}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    completingWeeklyId === task.occurrence.id
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-teal-300 bg-teal-100 text-teal-800 hover:bg-teal-200"
                  }`}
                >
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] ${
                      completingWeeklyId === task.occurrence.id ? "bg-white/20 tick-pop" : "bg-teal-700/10"
                    }`}
                  >
                    {completingWeeklyId === task.occurrence.id ? "✓" : ""}
                  </span>
                  {completingWeeklyId === task.occurrence.id ? "Done" : "Complete now"}
                </button>
              }
            >
              <p>
                Active window: {dayOfWeekLabels[task.assignment.dayOfWeek]} {formatActivationTime(task.assignment.activationTime)}
              </p>
              <p>Closes at: {formatDateTime(task.occurrence.cycleEndAt)}</p>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="active">Active weekly task</StatusPill>
                {task.isClosingSoon ? <StatusPill tone="urgent">Ending soon</StatusPill> : null}
              </div>
              {task.isClosingSoon ? (
                <p className="rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900">
                  Strong warning: this weekly task is close to the 24-hour cutoff.
                </p>
              ) : null}
            </AssignmentCard>
          ))}
        </div>

        {standardSorted.length === 0 && activeWeeklyTasks.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800">
            Everything is clear right now. No incomplete standard or active weekly items.
          </div>
        ) : null}
      </section>
    </div>
  );
};
