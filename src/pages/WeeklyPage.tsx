import { parseISO } from "date-fns";
import { AssignmentCard } from "../components/AssignmentCard";
import { StatusPill } from "../components/StatusPill";
import { dayOfWeekLabels, formatActivationTime, formatDateTime } from "../lib/dateUtils";
import type { ActiveWeeklyTask, Assignment, WeeklyOccurrence } from "../types/models";

interface WeeklyPageProps {
  assignments: Assignment[];
  occurrences: WeeklyOccurrence[];
  activeWeeklyTasks: ActiveWeeklyTask[];
  onCompleteWeekly: (occurrenceId: string) => Promise<void>;
}

export const WeeklyPage = ({
  assignments,
  occurrences,
  activeWeeklyTasks,
  onCompleteWeekly
}: WeeklyPageProps) => {
  const weeklyById = new Map(
    assignments
      .filter((assignment): assignment is Extract<Assignment, { type: "weekly" }> => assignment.type === "weekly")
      .map((assignment) => [assignment.id, assignment])
  );

  const history = occurrences
    .filter((occurrence) => occurrence.status !== "active")
    .map((occurrence) => ({
      occurrence,
      assignment: weeklyById.get(occurrence.assignmentId)
    }))
    .filter((entry) => entry.assignment)
    .sort((a, b) => +parseISO(b.occurrence.cycleStartAt) - +parseISO(a.occurrence.cycleStartAt))
    .slice(0, 30);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Weekly Dashboard</h2>
        <p className="text-sm text-slate-600">
          Only currently active weekly tasks appear here. They auto-expire after 24 hours if not completed.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {activeWeeklyTasks.map((task) => (
            <AssignmentCard
              key={task.occurrence.id}
              title={task.assignment.title}
              subtitle={`${task.assignment.unitName} • ${task.assignment.categoryName || "Uncategorized"}`}
              state="active"
              actions={
                <button
                  type="button"
                  onClick={() => void onCompleteWeekly(task.occurrence.id)}
                  className="rounded-lg border border-teal-300 bg-teal-100 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-200"
                >
                  Mark done
                </button>
              }
            >
              <p>
                Activates: {dayOfWeekLabels[task.assignment.dayOfWeek]} {formatActivationTime(task.assignment.activationTime)}
              </p>
              <p>Ends: {formatDateTime(task.occurrence.cycleEndAt)}</p>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="active">Glowing active task</StatusPill>
                {task.isClosingSoon ? <StatusPill tone="urgent">Strong warning</StatusPill> : null}
              </div>
            </AssignmentCard>
          ))}
        </div>

        {activeWeeklyTasks.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
            No active weekly tasks right now.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Weekly history (completed + missed)</h3>
        <div className="mt-3 space-y-2">
          {history.map(({ occurrence, assignment }) => (
            <div
              key={occurrence.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{assignment?.title}</p>
                <p className="text-slate-600">
                  Cycle: {formatDateTime(occurrence.cycleStartAt)} - {formatDateTime(occurrence.cycleEndAt)}
                </p>
              </div>
              <StatusPill tone={occurrence.status === "completed" ? "completed" : "missed"}>
                {occurrence.status}
              </StatusPill>
            </div>
          ))}

          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No weekly history entries yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};
