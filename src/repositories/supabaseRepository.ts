import { supabaseClient } from "../lib/supabase";
import type { Assignment, Category, ReminderLogEntry, StudySnapshot, WeeklyOccurrence } from "../types/models";
import type { StudyRepository } from "./types";

interface DbError {
  message: string;
  code?: string;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  id: string;
  type: "standard" | "weekly";
  title: string;
  unit_name: string;
  category_id: string | null;
  category_name: string;
  description: string;
  due_at: string | null;
  weekly_day_of_week: number | null;
  weekly_activation_time: string | null;
  reminder_offsets_minutes: number[];
  status: "pending" | "in_progress" | "completed";
  is_completed: boolean;
  is_active: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OccurrenceRow {
  id: string;
  assignment_id: string;
  cycle_start_at: string;
  cycle_end_at: string;
  status: "active" | "completed" | "missed";
  completed_at: string | null;
  missed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OccurrenceIdentityRow {
  id: string;
  assignment_id: string;
  cycle_start_at: string;
}

interface ReminderRow {
  id: string;
  reminder_key: string;
  assignment_id: string;
  occurrence_id: string | null;
  triggered_at: string;
  channel: "in_app" | "browser";
}

const ensureClient = () => {
  if (!supabaseClient) {
    throw new Error("Supabase client is not configured. Add env variables first.");
  }

  return supabaseClient;
};

const assertNoError = (error: DbError | null, context: string) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
};

const normalizeTime = (value: string | null): string => {
  if (!value) {
    return "09:00";
  }

  return value.slice(0, 5);
};

const toCategoryRow = (category: Category): CategoryRow => ({
  id: category.id,
  name: category.name,
  color: category.color,
  created_at: category.createdAt,
  updated_at: category.updatedAt
});

const fromCategoryRow = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toAssignmentRow = (assignment: Assignment): AssignmentRow => {
  if (assignment.type === "standard") {
    return {
      id: assignment.id,
      type: assignment.type,
      title: assignment.title,
      unit_name: assignment.unitName,
      category_id: assignment.categoryId,
      category_name: assignment.categoryName,
      description: assignment.description,
      due_at: assignment.dueAt,
      weekly_day_of_week: null,
      weekly_activation_time: null,
      reminder_offsets_minutes: assignment.reminderOffsetsInMinutes,
      status: assignment.status,
      is_completed: assignment.isCompleted,
      is_active: true,
      completed_at: assignment.completedAt,
      created_at: assignment.createdAt,
      updated_at: assignment.updatedAt
    };
  }

  return {
    id: assignment.id,
    type: assignment.type,
    title: assignment.title,
    unit_name: assignment.unitName,
    category_id: assignment.categoryId,
    category_name: assignment.categoryName,
    description: assignment.description,
    due_at: null,
    weekly_day_of_week: assignment.dayOfWeek,
    weekly_activation_time: assignment.activationTime,
    reminder_offsets_minutes: assignment.reminderOffsetsInMinutes,
    status: "pending",
    is_completed: false,
    is_active: assignment.isActive,
    completed_at: null,
    created_at: assignment.createdAt,
    updated_at: assignment.updatedAt
  };
};

const fromAssignmentRow = (row: AssignmentRow): Assignment => {
  if (row.type === "standard") {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      unitName: row.unit_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description,
      dueAt: row.due_at ?? new Date().toISOString(),
      reminderOffsetsInMinutes: row.reminder_offsets_minutes ?? [],
      status: row.status,
      isCompleted: row.is_completed,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    unitName: row.unit_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    description: row.description,
    dayOfWeek: row.weekly_day_of_week ?? 1,
    activationTime: normalizeTime(row.weekly_activation_time),
    reminderOffsetsInMinutes: row.reminder_offsets_minutes ?? [],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const toOccurrenceRow = (occurrence: WeeklyOccurrence): OccurrenceRow => ({
  id: occurrence.id,
  assignment_id: occurrence.assignmentId,
  cycle_start_at: occurrence.cycleStartAt,
  cycle_end_at: occurrence.cycleEndAt,
  status: occurrence.status,
  completed_at: occurrence.completedAt,
  missed_at: occurrence.missedAt,
  created_at: occurrence.createdAt,
  updated_at: occurrence.updatedAt
});

const fromOccurrenceRow = (row: OccurrenceRow): WeeklyOccurrence => ({
  id: row.id,
  assignmentId: row.assignment_id,
  cycleStartAt: row.cycle_start_at,
  cycleEndAt: row.cycle_end_at,
  status: row.status,
  completedAt: row.completed_at,
  missedAt: row.missed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toReminderRow = (entry: ReminderLogEntry): ReminderRow => ({
  id: entry.id,
  reminder_key: entry.reminderKey,
  assignment_id: entry.assignmentId,
  occurrence_id: entry.occurrenceId,
  triggered_at: entry.triggeredAt,
  channel: entry.channel
});

const fromReminderRow = (row: ReminderRow): ReminderLogEntry => ({
  id: row.id,
  reminderKey: row.reminder_key,
  assignmentId: row.assignment_id,
  occurrenceId: row.occurrence_id,
  triggeredAt: row.triggered_at,
  channel: row.channel
});

const toOccurrenceKey = (assignmentId: string, cycleStartAt: string): string =>
  `${assignmentId}::${cycleStartAt}`;

const dedupeOccurrenceRows = (rows: OccurrenceRow[]): OccurrenceRow[] => {
  const byKey = new Map<string, OccurrenceRow>();

  for (const row of rows) {
    const key = toOccurrenceKey(row.assignment_id, row.cycle_start_at);
    const existing = byKey.get(key);

    if (!existing || existing.updated_at < row.updated_at) {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values());
};

const isOccurrenceDuplicateKeyError = (error: DbError): boolean => {
  return (
    error.code === "23505" &&
    error.message.includes("assignment_occurrences_user_id_assignment_id_cycle_start_at_key")
  );
};

const syncTableById = async <TRow extends { id: string }>(
  table: string,
  rows: TRow[]
): Promise<void> => {
  const client = ensureClient();

  const { data: existingRows, error: selectError } = await client.from(table).select("id");
  assertNoError(selectError, `Unable to read ids from ${table}`);

  const existingIds = (existingRows ?? []).map((row: { id: string }) => row.id);

  if (rows.length > 0) {
    const { error: upsertError } = await client.from(table).upsert(rows, { onConflict: "id" });
    assertNoError(upsertError, `Unable to upsert ${table}`);
  }

  const keepIds = new Set(rows.map((row) => row.id));
  const staleIds = existingIds.filter((id) => !keepIds.has(id));
  if (staleIds.length > 0) {
    const { error: deleteError } = await client.from(table).delete().in("id", staleIds);
    assertNoError(deleteError, `Unable to delete stale rows from ${table}`);
  }
};

const syncOccurrenceRows = async (rows: OccurrenceRow[]): Promise<void> => {
  const client = ensureClient();
  const dedupedRows = dedupeOccurrenceRows(rows);

  const runSync = async (): Promise<DbError | null> => {
    const { data: existingRows, error: selectError } = await client
      .from("assignment_occurrences")
      .select("id, assignment_id, cycle_start_at");
    assertNoError(selectError, "Unable to read ids from assignment_occurrences");

    const identityRows = (existingRows ?? []) as OccurrenceIdentityRow[];
    const existingIds = identityRows.map((row) => row.id);
    const idByCompositeKey = new Map(
      identityRows.map((row) => [toOccurrenceKey(row.assignment_id, row.cycle_start_at), row.id])
    );

    const normalizedRows = dedupedRows.map((row) => {
      const existingId = idByCompositeKey.get(toOccurrenceKey(row.assignment_id, row.cycle_start_at));
      return existingId ? { ...row, id: existingId } : row;
    });

    if (normalizedRows.length > 0) {
      const { error: upsertError } = await client
        .from("assignment_occurrences")
        .upsert(normalizedRows, { onConflict: "id" });

      if (upsertError) {
        return upsertError as DbError;
      }
    }

    const keepIds = new Set(normalizedRows.map((row) => row.id));
    const staleIds = existingIds.filter((id) => !keepIds.has(id));

    if (staleIds.length > 0) {
      const { error: deleteError } = await client.from("assignment_occurrences").delete().in("id", staleIds);
      assertNoError(deleteError, "Unable to delete stale rows from assignment_occurrences");
    }

    return null;
  };

  const firstError = await runSync();
  if (!firstError) {
    return;
  }

  if (!isOccurrenceDuplicateKeyError(firstError)) {
    assertNoError(firstError, "Unable to upsert assignment_occurrences");
    return;
  }

  const retryError = await runSync();
  assertNoError(retryError, "Unable to upsert assignment_occurrences");
};

export class SupabaseStudyRepository implements StudyRepository {
  readonly mode = "supabase" as const;

  async load(): Promise<StudySnapshot> {
    const client = ensureClient();

    const [categoryResult, assignmentResult, occurrenceResult, reminderResult] = await Promise.all([
      client.from("categories").select("*"),
      client.from("assignments").select("*"),
      client.from("assignment_occurrences").select("*"),
      client.from("reminder_logs").select("*")
    ]);

    assertNoError(categoryResult.error, "Unable to load categories");
    assertNoError(assignmentResult.error, "Unable to load assignments");
    assertNoError(occurrenceResult.error, "Unable to load occurrences");
    assertNoError(reminderResult.error, "Unable to load reminder logs");

    return {
      categories: (categoryResult.data ?? []).map((row) => fromCategoryRow(row as CategoryRow)),
      assignments: (assignmentResult.data ?? []).map((row) => fromAssignmentRow(row as AssignmentRow)),
      occurrences: (occurrenceResult.data ?? []).map((row) => fromOccurrenceRow(row as OccurrenceRow)),
      reminderLog: (reminderResult.data ?? []).map((row) => fromReminderRow(row as ReminderRow))
    };
  }

  async save(snapshot: StudySnapshot): Promise<void> {
    await syncTableById(
      "categories",
      snapshot.categories.map(toCategoryRow)
    );

    await syncTableById(
      "assignments",
      snapshot.assignments.map(toAssignmentRow)
    );

    await syncOccurrenceRows(snapshot.occurrences.map(toOccurrenceRow));

    await syncTableById(
      "reminder_logs",
      snapshot.reminderLog.map(toReminderRow)
    );
  }
}
