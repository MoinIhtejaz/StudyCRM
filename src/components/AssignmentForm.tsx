import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { dayOfWeekLabels } from "../lib/dateUtils";
import { ReminderSelector } from "./ReminderSelector";
import type { AssignmentDraft, Category } from "../types/models";

interface AssignmentFormProps {
  categories: Category[];
  defaultReminderOffsetsInMinutes: number[];
  initialDraft: AssignmentDraft | null;
  onCancelEdit: () => void;
  onSubmit: (draft: AssignmentDraft) => Promise<void>;
}

const createDefaultDraft = (defaultOffsets: number[]): AssignmentDraft => {
  const tomorrow = addDays(new Date(), 1);

  return {
    type: "standard",
    title: "",
    unitName: "",
    categoryId: null,
    categoryName: "",
    description: "",
    reminderOffsetsInMinutes: defaultOffsets,
    dueDate: format(tomorrow, "yyyy-MM-dd"),
    dueTime: "17:00",
    status: "pending",
    dayOfWeek: 1,
    activationTime: "09:00",
    isActive: true
  };
};

const trimCategory = (categories: Category[], categoryName: string): { categoryId: string | null; categoryName: string } => {
  const trimmed = categoryName.trim();
  if (!trimmed) {
    return { categoryId: null, categoryName: "" };
  }

  const existing = categories.find((category) => category.name.toLowerCase() === trimmed.toLowerCase());
  if (!existing) {
    return {
      categoryId: null,
      categoryName: trimmed
    };
  }

  return {
    categoryId: existing.id,
    categoryName: existing.name
  };
};

export const AssignmentForm = ({
  categories,
  defaultReminderOffsetsInMinutes,
  initialDraft,
  onCancelEdit,
  onSubmit
}: AssignmentFormProps) => {
  const [draft, setDraft] = useState<AssignmentDraft>(() =>
    createDefaultDraft(defaultReminderOffsetsInMinutes)
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialDraft) {
      setDraft(initialDraft);
      return;
    }

    setDraft(createDefaultDraft(defaultReminderOffsetsInMinutes));
  }, [initialDraft, defaultReminderOffsetsInMinutes]);

  const categorySuggestions = useMemo(() => categories.map((category) => category.name), [categories]);

  const updateDraft = <Key extends keyof AssignmentDraft>(key: Key, value: AssignmentDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = draft.title.trim();
    const unitName = draft.unitName.trim();

    if (!title || !unitName) {
      return;
    }

    if (draft.type === "standard" && (!draft.dueDate || !draft.dueTime)) {
      return;
    }

    if (draft.type === "weekly" && !draft.activationTime) {
      return;
    }

    setIsSaving(true);
    try {
      const resolvedCategory = trimCategory(categories, draft.categoryName);
      await onSubmit({
        ...draft,
        title,
        unitName,
        categoryId: resolvedCategory.categoryId,
        categoryName: resolvedCategory.categoryName
      });

      if (!draft.id) {
        setDraft(createDefaultDraft(defaultReminderOffsetsInMinutes));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {draft.id ? "Edit Assignment" : "Add Assignment"}
        </h2>
        {draft.id ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel edit
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Assignment type</span>
          <select
            value={draft.type}
            onChange={(event) => updateDraft("type", event.target.value as AssignmentDraft["type"])}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="standard">Standard</option>
            <option value="weekly">Weekly recurring</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Unit / Subject</span>
          <input
            value={draft.unitName}
            onChange={(event) => updateDraft("unitName", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
      </div>

      <label className="space-y-1 text-sm block">
        <span className="font-medium text-slate-700">Title</span>
        <input
          value={draft.title}
          onChange={(event) => updateDraft("title", event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          required
        />
      </label>

      <label className="space-y-1 text-sm block">
        <span className="font-medium text-slate-700">Category</span>
        <input
          list="category-options"
          value={draft.categoryName}
          onChange={(event) => updateDraft("categoryName", event.target.value)}
          placeholder="Exam, Quiz, Lab, Project..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <datalist id="category-options">
          {categorySuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>

      <label className="space-y-1 text-sm block">
        <span className="font-medium text-slate-700">Description</span>
        <textarea
          value={draft.description}
          onChange={(event) => updateDraft("description", event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {draft.type === "standard" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Due date</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => updateDraft("dueDate", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Due time</span>
            <input
              type="time"
              value={draft.dueTime}
              onChange={(event) => updateDraft("dueTime", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Status</span>
            <select
              value={draft.status}
              onChange={(event) => updateDraft("status", event.target.value as AssignmentDraft["status"])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Day of week</span>
            <select
              value={draft.dayOfWeek}
              onChange={(event) => updateDraft("dayOfWeek", Number(event.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {dayOfWeekLabels.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Activation time</span>
            <input
              type="time"
              value={draft.activationTime}
              onChange={(event) => updateDraft("activationTime", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>

          <label className="flex items-center gap-2 self-end rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => updateDraft("isActive", event.target.checked)}
            />
            Weekly definition active
          </label>
        </div>
      )}

      <ReminderSelector
        value={draft.reminderOffsetsInMinutes}
        onChange={(next) => updateDraft("reminderOffsetsInMinutes", next)}
      />

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
      >
        {isSaving ? "Saving..." : draft.id ? "Update assignment" : "Create assignment"}
      </button>
    </form>
  );
};
