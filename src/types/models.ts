export type AssignmentType = "standard" | "weekly";
export type StandardAssignmentStatus = "pending" | "in_progress" | "completed";
export type WeeklyOccurrenceStatus = "active" | "completed" | "missed";
export type StorageMode = "local" | "supabase";

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentBase {
  id: string;
  type: AssignmentType;
  title: string;
  unitName: string;
  categoryId: string | null;
  categoryName: string;
  description: string;
  reminderOffsetsInMinutes: number[];
  createdAt: string;
  updatedAt: string;
}

export interface StandardAssignment extends AssignmentBase {
  type: "standard";
  dueAt: string;
  status: StandardAssignmentStatus;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface WeeklyAssignment extends AssignmentBase {
  type: "weekly";
  dayOfWeek: number;
  activationTime: string;
  isActive: boolean;
}

export type Assignment = StandardAssignment | WeeklyAssignment;

export interface WeeklyOccurrence {
  id: string;
  assignmentId: string;
  cycleStartAt: string;
  cycleEndAt: string;
  status: WeeklyOccurrenceStatus;
  completedAt: string | null;
  missedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderLogEntry {
  id: string;
  reminderKey: string;
  assignmentId: string;
  occurrenceId: string | null;
  triggeredAt: string;
  channel: "in_app" | "browser";
}

export interface StudySnapshot {
  categories: Category[];
  assignments: Assignment[];
  occurrences: WeeklyOccurrence[];
  reminderLog: ReminderLogEntry[];
}

export interface ReminderEvent {
  reminderKey: string;
  assignmentId: string;
  occurrenceId?: string;
  title: string;
  message: string;
  type: "info" | "warning";
}

export interface AppSettings {
  defaultReminderOffsetsInMinutes: number[];
}

export interface AssignmentDraft {
  id?: string;
  type: AssignmentType;
  title: string;
  unitName: string;
  categoryId: string | null;
  categoryName: string;
  description: string;
  reminderOffsetsInMinutes: number[];
  dueDate: string;
  dueTime: string;
  status: StandardAssignmentStatus;
  dayOfWeek: number;
  activationTime: string;
  isActive: boolean;
}

export interface ActiveWeeklyTask {
  assignment: WeeklyAssignment;
  occurrence: WeeklyOccurrence;
  remainingMinutes: number;
  isClosingSoon: boolean;
}
