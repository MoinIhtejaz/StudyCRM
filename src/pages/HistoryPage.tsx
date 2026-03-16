import { parseISO } from "date-fns";
import { StatusPill } from "../components/StatusPill";
import { formatDateTime } from "../lib/dateUtils";
import type { Assignment, WeeklyOccurrence } from "../types/models";

interface HistoryPageProps {
  assignments: Assignment[];
  occurrences: WeeklyOccurrence[];
}

export const HistoryPage = ({ assignments, occurrences }: HistoryPageProps) => {
  const completedStandard = assignments
    .filter((assignment): assignment is Extract<Assignment, { type: "standard" }> => assignment.type === "standard")
    .filter((assignment) => assignment.isCompleted)
    .sort((a, b) => +parseISO(b.completedAt ?? b.updatedAt) - +parseISO(a.completedAt ?? a.updatedAt));

  const weeklyById = new Map(
    assignments
      .filter((assignment): assignment is Extract<Assignment, { type: "weekly" }> => assignment.type === "weekly")
      .map((assignment) => [assignment.id, assignment])
  );

  const weeklyHistory = occurrences
    .filter((occurrence) => occurrence.status === "completed" || occurrence.status === "missed")
    .sort((a, b) => +parseISO(b.updatedAt) - +parseISO(a.updatedAt));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-slate-900">Standard Assignment History</h2>
        <div className="mt-4 space-y-2">
          {completedStandard.map((assignment) => (
            <div
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-emerald-900">{assignment.title}</p>
                <p className="text-emerald-800">{assignment.unitName}</p>
              </div>
              <p className="text-emerald-900">
                Completed: {assignment.completedAt ? formatDateTime(assignment.completedAt) : "Unknown"}
              </p>
            </div>
          ))}

          {completedStandard.length === 0 ? (
            <p className="text-sm text-slate-500">No completed standard assignments yet.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-slate-900">Weekly Occurrence History</h2>
        <div className="mt-4 space-y-2">
          {weeklyHistory.map((occurrence) => (
            <div
              key={occurrence.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{weeklyById.get(occurrence.assignmentId)?.title}</p>
                <p className="text-slate-600">
                  {formatDateTime(occurrence.cycleStartAt)} - {formatDateTime(occurrence.cycleEndAt)}
                </p>
              </div>
              <StatusPill tone={occurrence.status === "completed" ? "completed" : "missed"}>
                {occurrence.status}
              </StatusPill>
            </div>
          ))}

          {weeklyHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No weekly completed/missed history yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};
