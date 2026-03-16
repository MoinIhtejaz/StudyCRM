import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { combineDateAndTime } from "../lib/dateUtils";
import { createId } from "../lib/id";
import { collectReminderEvents, pruneReminderLog } from "../lib/reminderEngine";
import { reconcileWeeklyOccurrences } from "../lib/weeklyEngine";
import { getPreferredRepository } from "../repositories/repositoryFactory";
import type { StudyRepository } from "../repositories/types";
import type {
  AppSettings,
  Assignment,
  AssignmentDraft,
  Category,
  ReminderEvent,
  StorageMode,
  StudySnapshot,
  WeeklyOccurrence
} from "../types/models";

const DEFAULT_SETTINGS: AppSettings = {
  defaultReminderOffsetsInMinutes: [1440, 360, 30]
};

const SETTINGS_STORAGE_KEY = "studycrm_settings_v1";

const emptySnapshot: StudySnapshot = {
  categories: [],
  assignments: [],
  occurrences: [],
  reminderLog: []
};

const readStoredSettings = (): AppSettings => {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as AppSettings;
    if (!parsed.defaultReminderOffsetsInMinutes?.length) {
      return DEFAULT_SETTINGS;
    }

    return {
      defaultReminderOffsetsInMinutes: [...new Set(parsed.defaultReminderOffsetsInMinutes)].sort((a, b) => b - a)
    };
  } catch (_error) {
    return DEFAULT_SETTINGS;
  }
};

const writeStoredSettings = (settings: AppSettings): void => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

const normalizeSnapshot = (snapshot: StudySnapshot): StudySnapshot => {
  const occurrenceResult = reconcileWeeklyOccurrences(
    snapshot.assignments,
    snapshot.occurrences,
    new Date().toISOString()
  );

  return {
    categories: snapshot.categories,
    assignments: snapshot.assignments,
    occurrences: occurrenceResult.occurrences,
    reminderLog: pruneReminderLog(snapshot.reminderLog)
  };
};

const getCategoryColor = (categories: Category[]): string => {
  const palette = [
    "#0f766e",
    "#0369a1",
    "#7c2d12",
    "#334155",
    "#166534",
    "#9333ea",
    "#be185d",
    "#1f2937"
  ];

  const index = categories.length % palette.length;
  return palette[index];
};

const findOrCreateCategory = (
  categories: Category[],
  categoryId: string | null,
  categoryName: string,
  nowIso: string
): { categories: Category[]; categoryId: string | null; categoryName: string } => {
  const trimmed = categoryName.trim();

  if (!trimmed) {
    return {
      categories,
      categoryId,
      categoryName: "Uncategorized"
    };
  }

  const existingById = categoryId ? categories.find((category) => category.id === categoryId) : undefined;
  if (existingById) {
    return {
      categories,
      categoryId: existingById.id,
      categoryName: existingById.name
    };
  }

  const existingByName = categories.find(
    (category) => category.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existingByName) {
    return {
      categories,
      categoryId: existingByName.id,
      categoryName: existingByName.name
    };
  }

  const newCategory: Category = {
    id: createId(),
    name: trimmed,
    color: getCategoryColor(categories),
    createdAt: nowIso,
    updatedAt: nowIso
  };

  return {
    categories: [...categories, newCategory],
    categoryId: newCategory.id,
    categoryName: newCategory.name
  };
};

const sanitizeText = (value: string, maxLength: number): string => {
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maxLength);
};

const upsertAssignment = (
  currentAssignments: Assignment[],
  draft: Assignment
): Assignment[] => {
  const found = currentAssignments.some((assignment) => assignment.id === draft.id);
  if (!found) {
    return [draft, ...currentAssignments];
  }

  return currentAssignments.map((assignment) => (assignment.id === draft.id ? draft : assignment));
};

export const useStudyCRM = (enabled = true) => {
  const [snapshot, setSnapshot] = useState<StudySnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("supabase");
  const [settings, setSettingsState] = useState<AppSettings>(() => readStoredSettings());

  const repositoryRef = useRef<StudyRepository>(getPreferredRepository());
  const snapshotRef = useRef<StudySnapshot>(emptySnapshot);

  const persistSnapshot = useCallback(async (nextSnapshot: StudySnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);

    try {
      await repositoryRef.current.save(nextSnapshot);
    } catch (persistError) {
      const message =
        persistError instanceof Error ? persistError.message : "Unable to save latest changes.";
      setError(message);
    }
  }, []);

  const initialize = useCallback(async () => {
    if (!enabled) {
      snapshotRef.current = emptySnapshot;
      setSnapshot(emptySnapshot);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setStorageMode("supabase");

    const repository = getPreferredRepository();

    try {
      const loaded = await repository.load();
      const normalized = normalizeSnapshot(loaded);

      repositoryRef.current = repository;
      setStorageMode(repository.mode);
      snapshotRef.current = normalized;
      setSnapshot(normalized);

      if (JSON.stringify(loaded) !== JSON.stringify(normalized)) {
        await repository.save(normalized);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load data.";
      setError(`Supabase-only mode: ${message}`);
      snapshotRef.current = emptySnapshot;
      setSnapshot(emptySnapshot);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const saveSettings = useCallback((next: AppSettings) => {
    setSettingsState(next);
    writeStoredSettings(next);
  }, []);

  const runMaintenance = useCallback(async (): Promise<ReminderEvent[]> => {
    if (!enabled) {
      return [];
    }

    const nowIso = new Date().toISOString();
    const current = snapshotRef.current;

    const reconcileResult = reconcileWeeklyOccurrences(current.assignments, current.occurrences, nowIso);

    const reminderResult = collectReminderEvents({
      assignments: current.assignments,
      occurrences: reconcileResult.occurrences,
      reminderLog: current.reminderLog,
      nowIso
    });

    const nextSnapshot: StudySnapshot = {
      ...current,
      occurrences: reconcileResult.occurrences,
      reminderLog: pruneReminderLog(reminderResult.reminderLog)
    };

    const changed =
      reconcileResult.changed || nextSnapshot.reminderLog.length !== current.reminderLog.length;

    if (changed) {
      await persistSnapshot(nextSnapshot);
    }

    return reminderResult.events;
  }, [enabled, persistSnapshot]);

  const mutateSnapshot = useCallback(
    async (mutator: (current: StudySnapshot) => StudySnapshot) => {
      const current = snapshotRef.current;
      const mutated = mutator(current);
      const normalized = normalizeSnapshot(mutated);
      await persistSnapshot(normalized);
    },
    [persistSnapshot]
  );

  const saveAssignment = useCallback(
    async (draft: AssignmentDraft) => {
      const nowIso = new Date().toISOString();

      await mutateSnapshot((current) => {
        const existing = draft.id
          ? current.assignments.find((assignment) => assignment.id === draft.id)
          : undefined;

        const categoryResult = findOrCreateCategory(
          current.categories,
          draft.categoryId,
          draft.categoryName,
          nowIso
        );

        const reminderOffsets =
          draft.reminderOffsetsInMinutes.length > 0
            ? [...new Set(draft.reminderOffsetsInMinutes)].sort((a, b) => b - a)
            : settings.defaultReminderOffsetsInMinutes;

        const base = {
          id: draft.id ?? createId(),
          title: sanitizeText(draft.title, 140),
          unitName: sanitizeText(draft.unitName, 80),
          categoryId: categoryResult.categoryId,
          categoryName: sanitizeText(categoryResult.categoryName, 60),
          description: sanitizeText(draft.description, 2000),
          reminderOffsetsInMinutes: reminderOffsets,
          createdAt: existing?.createdAt ?? nowIso,
          updatedAt: nowIso
        };

        const assignment: Assignment =
          draft.type === "standard"
            ? {
                ...base,
                type: "standard",
                dueAt: combineDateAndTime(draft.dueDate, draft.dueTime),
                status: draft.status,
                isCompleted: existing?.type === "standard" ? existing.isCompleted : false,
                completedAt: existing?.type === "standard" ? existing.completedAt : null
              }
            : {
                ...base,
                type: "weekly",
                dayOfWeek: draft.dayOfWeek,
                activationTime: draft.activationTime,
                isActive: draft.isActive
              };

        const nextAssignments = upsertAssignment(current.assignments, assignment);
        const existingType = existing?.type;
        const typeChanged = existingType && existingType !== draft.type;

        const nextOccurrences: WeeklyOccurrence[] = typeChanged
          ? current.occurrences.filter((occurrence) => occurrence.assignmentId !== assignment.id)
          : current.occurrences;

        const nextReminderLog = current.reminderLog.filter((entry) => entry.assignmentId !== assignment.id);

        return {
          categories: categoryResult.categories,
          assignments: nextAssignments,
          occurrences: nextOccurrences,
          reminderLog: nextReminderLog
        };
      });
    },
    [mutateSnapshot, settings.defaultReminderOffsetsInMinutes]
  );

  const removeAssignment = useCallback(
    async (assignmentId: string) => {
      await mutateSnapshot((current) => ({
        categories: current.categories,
        assignments: current.assignments.filter((assignment) => assignment.id !== assignmentId),
        occurrences: current.occurrences.filter((occurrence) => occurrence.assignmentId !== assignmentId),
        reminderLog: current.reminderLog.filter((entry) => entry.assignmentId !== assignmentId)
      }));
    },
    [mutateSnapshot]
  );

  const toggleStandardCompletion = useCallback(
    async (assignmentId: string, isCompleted: boolean) => {
      const nowIso = new Date().toISOString();

      await mutateSnapshot((current) => ({
        ...current,
        assignments: current.assignments.map((assignment) => {
          if (assignment.id !== assignmentId || assignment.type !== "standard") {
            return assignment;
          }

          return {
            ...assignment,
            isCompleted,
            completedAt: isCompleted ? nowIso : null,
            status: isCompleted ? "completed" : "pending",
            updatedAt: nowIso
          };
        })
      }));
    },
    [mutateSnapshot]
  );

  const completeWeeklyOccurrence = useCallback(
    async (occurrenceId: string) => {
      const nowIso = new Date().toISOString();

      await mutateSnapshot((current) => ({
        ...current,
        occurrences: current.occurrences.map((occurrence) => {
          if (occurrence.id !== occurrenceId) {
            return occurrence;
          }

          return {
            ...occurrence,
            status: "completed",
            completedAt: nowIso,
            updatedAt: nowIso
          };
        })
      }));
    },
    [mutateSnapshot]
  );

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      await mutateSnapshot((current) => {
        const existing = current.categories.find(
          (category) => category.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) {
          return current;
        }

        const nowIso = new Date().toISOString();
        return {
          ...current,
          categories: [
            ...current.categories,
            {
              id: createId(),
              name: trimmed,
              color: getCategoryColor(current.categories),
              createdAt: nowIso,
              updatedAt: nowIso
            }
          ]
        };
      });
    },
    [mutateSnapshot]
  );

  const timezoneLabel = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const generatedAtLabel = useMemo(() => format(new Date(), "EEE d MMM yyyy, h:mm a"), [snapshot]);

  return {
    loading,
    error,
    storageMode,
    settings,
    snapshot,
    timezoneLabel,
    generatedAtLabel,
    saveSettings,
    saveAssignment,
    removeAssignment,
    toggleStandardCompletion,
    completeWeeklyOccurrence,
    addCategory,
    runMaintenance
  };
};
