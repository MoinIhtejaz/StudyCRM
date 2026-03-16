import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AssignmentCard } from "../components/AssignmentCard";
import { AssignmentForm } from "../components/AssignmentForm";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { StatusPill } from "../components/StatusPill";
import { dayOfWeekLabels, formatActivationTime, formatDateTime } from "../lib/dateUtils";
import type { Assignment, AssignmentDraft, Category } from "../types/models";

interface AssignmentsPageProps {
  assignments: Assignment[];
  categories: Category[];
  defaultReminderOffsetsInMinutes: number[];
  onSaveAssignment: (draft: AssignmentDraft) => Promise<void>;
  onDeleteAssignment: (assignmentId: string) => Promise<void>;
  onToggleStandardCompletion: (assignmentId: string, isCompleted: boolean) => Promise<void>;
}

const toDraft = (assignment: Assignment): AssignmentDraft => {
  if (assignment.type === "standard") {
    return {
      id: assignment.id,
      type: assignment.type,
      title: assignment.title,
      unitName: assignment.unitName,
      categoryId: assignment.categoryId,
      categoryName: assignment.categoryName,
      description: assignment.description,
      reminderOffsetsInMinutes: assignment.reminderOffsetsInMinutes,
      dueDate: format(parseISO(assignment.dueAt), "yyyy-MM-dd"),
      dueTime: format(parseISO(assignment.dueAt), "HH:mm"),
      status: assignment.status,
      dayOfWeek: 1,
      activationTime: "09:00",
      isActive: true
    };
  }

  return {
    id: assignment.id,
    type: assignment.type,
    title: assignment.title,
    unitName: assignment.unitName,
    categoryId: assignment.categoryId,
    categoryName: assignment.categoryName,
    description: assignment.description,
    reminderOffsetsInMinutes: assignment.reminderOffsetsInMinutes,
    dueDate: format(new Date(), "yyyy-MM-dd"),
    dueTime: "17:00",
    status: "pending",
    dayOfWeek: assignment.dayOfWeek,
    activationTime: assignment.activationTime,
    isActive: assignment.isActive
  };
};

export const AssignmentsPage = ({
  assignments,
  categories,
  defaultReminderOffsetsInMinutes,
  onSaveAssignment,
  onDeleteAssignment,
  onToggleStandardCompletion
}: AssignmentsPageProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "standard" | "weekly">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [completingStandardId, setCompletingStandardId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleteBusy, setIsDeleteBusy] = useState(false);

  const units = useMemo(() => {
    return [...new Set(assignments.map((assignment) => assignment.unitName))].sort();
  }, [assignments]);

  const completedStandard = useMemo(
    () =>
      assignments
        .filter((assignment): assignment is Extract<Assignment, { type: "standard" }> => assignment.type === "standard")
        .filter((assignment) => assignment.isCompleted)
        .sort((a, b) => +parseISO(b.completedAt ?? b.updatedAt) - +parseISO(a.completedAt ?? a.updatedAt)),
    [assignments]
  );

  const filteredAssignments = useMemo(() => {
    return assignments
      .filter((assignment) => {
        if (filterType !== "all" && assignment.type !== filterType) {
          return false;
        }

        if (filterCategory !== "all") {
          if (assignment.categoryId) {
            return assignment.categoryId === filterCategory;
          }

          return assignment.categoryName.toLowerCase() === filterCategory.toLowerCase();
        }

        if (filterUnit !== "all" && assignment.unitName !== filterUnit) {
          return false;
        }

        if (!search.trim()) {
          return true;
        }

        return assignment.title.toLowerCase().includes(search.trim().toLowerCase());
      })
      .sort((a, b) => +parseISO(b.updatedAt) - +parseISO(a.updatedAt));
  }, [assignments, filterCategory, filterType, filterUnit, search]);

  const editingDraft = useMemo(() => {
    if (!editingId) {
      return null;
    }

    const target = assignments.find((assignment) => assignment.id === editingId);
    return target ? toDraft(target) : null;
  }, [assignments, editingId]);

  const onSubmit = async (draft: AssignmentDraft) => {
    await onSaveAssignment(draft);
    setEditingId(null);
  };

  const triggerStandardToggle = async (assignmentId: string, isCompleted: boolean) => {
    if (isCompleted) {
      await onToggleStandardCompletion(assignmentId, false);
      return;
    }

    if (completingStandardId) {
      return;
    }

    setCompletingStandardId(assignmentId);
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    await onToggleStandardCompletion(assignmentId, true);
    setCompletingStandardId(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setIsDeleteBusy(true);
    try {
      await onDeleteAssignment(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsDeleteBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
      <AssignmentForm
        categories={categories}
        defaultReminderOffsetsInMinutes={defaultReminderOffsetsInMinutes}
        initialDraft={editingDraft}
        onCancelEdit={() => setEditingId(null)}
        onSubmit={onSubmit}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Assignment Management Panel</h2>
          <p className="text-sm text-slate-600">Filter by category, type, unit, and title search.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as "all" | "standard" | "weekly")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All types</option>
              <option value="standard">Standard</option>
              <option value="weekly">Weekly</option>
            </select>

            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={filterUnit}
              onChange={(event) => setFilterUnit(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All units</option>
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-3">
          {filteredAssignments.map((assignment) => {
            if (assignment.type === "standard") {
              const state = assignment.isCompleted ? "completed" : "normal";
              const isCompleting = completingStandardId === assignment.id;

              return (
                <AssignmentCard
                  key={assignment.id}
                  title={assignment.title}
                  subtitle={`${assignment.unitName} • ${assignment.categoryName || "Uncategorized"}`}
                  state={state}
                  actions={
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(assignment.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ id: assignment.id, title: assignment.title })}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
                  }
                >
                  <p>Due: {formatDateTime(assignment.dueAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={assignment.isCompleted ? "completed" : "normal"}>
                      {assignment.isCompleted ? "Completed" : "Open"}
                    </StatusPill>
                    <StatusPill tone="normal">Status: {assignment.status.replace("_", " ")}</StatusPill>
                  </div>
                  <button
                    type="button"
                    onClick={() => void triggerStandardToggle(assignment.id, assignment.isCompleted)}
                    disabled={isCompleting}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      assignment.isCompleted
                        ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        : isCompleting
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {!assignment.isCompleted ? (
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] ${
                          isCompleting ? "bg-white/20 tick-pop" : "bg-emerald-700/10"
                        }`}
                      >
                        {isCompleting ? "✓" : ""}
                      </span>
                    ) : null}
                    {assignment.isCompleted ? "Mark incomplete" : isCompleting ? "Done" : "Mark done"}
                  </button>
                </AssignmentCard>
              );
            }

            return (
              <AssignmentCard
                key={assignment.id}
                title={assignment.title}
                subtitle={`${assignment.unitName} • ${assignment.categoryName || "Uncategorized"}`}
                state={assignment.isActive ? "active" : "normal"}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(assignment.id)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ id: assignment.id, title: assignment.title })}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                }
              >
                <p>
                  Schedule: {dayOfWeekLabels[assignment.dayOfWeek]} at {formatActivationTime(assignment.activationTime)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={assignment.isActive ? "active" : "normal"}>
                    {assignment.isActive ? "Definition active" : "Paused"}
                  </StatusPill>
                </div>
              </AssignmentCard>
            );
          })}

          {filteredAssignments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              No assignments match the current filters.
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Completed Standard Assignment History</h3>
          <div className="mt-3 space-y-2">
            {completedStandard.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
              >
                <p className="font-medium text-emerald-900">{assignment.title}</p>
                <p className="text-emerald-800">
                  Completed: {assignment.completedAt ? formatDateTime(assignment.completedAt) : "Unknown"}
                </p>
              </div>
            ))}
            {completedStandard.length === 0 ? (
              <p className="text-sm text-slate-500">No completed standard assignments yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <ConfirmationModal
        open={Boolean(pendingDelete)}
        title="Remove assignment?"
        message={`Do you really want to remove the assignment \"${pendingDelete?.title ?? ""}\"? This action cannot be undone.`}
        confirmLabel="Yes, remove"
        cancelLabel="Cancel"
        isBusy={isDeleteBusy}
        onCancel={() => {
          if (!isDeleteBusy) {
            setPendingDelete(null);
          }
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
