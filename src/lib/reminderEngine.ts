import { addMinutes, isAfter, isBefore, parseISO, subMinutes } from "date-fns";
import { createId } from "./id";
import { getNextActivation } from "./dateUtils";
import type {
  Assignment,
  ReminderEvent,
  ReminderLogEntry,
  WeeklyAssignment,
  WeeklyOccurrence
} from "../types/models";

interface ReminderResult {
  events: ReminderEvent[];
  reminderLog: ReminderLogEntry[];
}

interface ReminderInput {
  assignments: Assignment[];
  occurrences: WeeklyOccurrence[];
  reminderLog: ReminderLogEntry[];
  nowIso: string;
}

const REMINDER_WINDOW_MINUTES = 20;

const shouldTriggerNow = (triggerAt: Date, now: Date): boolean => {
  if (isBefore(now, triggerAt)) {
    return false;
  }

  const upperBound = addMinutes(triggerAt, REMINDER_WINDOW_MINUTES);
  return isBefore(now, upperBound) || +now === +upperBound;
};

const pushEvent = (
  events: ReminderEvent[],
  reminderLog: ReminderLogEntry[],
  existingKeys: Set<string>,
  event: ReminderEvent,
  nowIso: string
): void => {
  if (existingKeys.has(event.reminderKey)) {
    return;
  }

  events.push(event);
  reminderLog.push({
    id: createId(),
    reminderKey: event.reminderKey,
    assignmentId: event.assignmentId,
    occurrenceId: event.occurrenceId ?? null,
    triggeredAt: nowIso,
    channel: "in_app"
  });
  existingKeys.add(event.reminderKey);
};

const dedupeOffsets = (offsets: number[]): number[] => {
  return [...new Set(offsets)].filter((offset) => offset >= 0).sort((a, b) => b - a);
};

export const collectReminderEvents = ({
  assignments,
  occurrences,
  reminderLog,
  nowIso
}: ReminderInput): ReminderResult => {
  const now = parseISO(nowIso);
  const events: ReminderEvent[] = [];
  const nextReminderLog = [...reminderLog];
  const existingKeys = new Set(reminderLog.map((entry) => entry.reminderKey));

  for (const assignment of assignments) {
    const offsets = dedupeOffsets(assignment.reminderOffsetsInMinutes);

    if (assignment.type === "standard" && !assignment.isCompleted) {
      const dueAt = parseISO(assignment.dueAt);

      for (const offset of offsets) {
        const triggerAt = subMinutes(dueAt, offset);
        const reminderKey = `standard:${assignment.id}:${assignment.dueAt}:${offset}`;

        if (shouldTriggerNow(triggerAt, now)) {
          pushEvent(events, nextReminderLog, existingKeys, {
            reminderKey,
            assignmentId: assignment.id,
            title: `Reminder: ${assignment.title}`,
            message: `${assignment.unitName} is due at ${dueAt.toLocaleString()}.`,
            type: "warning"
          }, nowIso);
        }
      }

      continue;
    }

    if (assignment.type !== "weekly" || !assignment.isActive) {
      continue;
    }

    const weeklyAssignment = assignment as WeeklyAssignment;
    const relatedOccurrences = occurrences.filter(
      (occurrence) => occurrence.assignmentId === assignment.id && occurrence.status === "active"
    );

    for (const occurrence of relatedOccurrences) {
      const cycleStart = parseISO(occurrence.cycleStartAt);

      for (const offset of offsets) {
        const triggerAt = subMinutes(cycleStart, offset);
        const reminderKey = `weekly:${assignment.id}:${occurrence.cycleStartAt}:${offset}`;

        if (shouldTriggerNow(triggerAt, now)) {
          pushEvent(events, nextReminderLog, existingKeys, {
            reminderKey,
            assignmentId: assignment.id,
            occurrenceId: occurrence.id,
            title: `Weekly task: ${assignment.title}`,
            message: `Activation window is live for ${assignment.unitName}.`,
            type: "info"
          }, nowIso);
        }
      }

      const cycleEnd = parseISO(occurrence.cycleEndAt);
      const warningTriggerAt = subMinutes(cycleEnd, 120);
      const endWarningKey = `weekly-end:${occurrence.id}`;
      if (shouldTriggerNow(warningTriggerAt, now)) {
        pushEvent(events, nextReminderLog, existingKeys, {
          reminderKey: endWarningKey,
          assignmentId: assignment.id,
          occurrenceId: occurrence.id,
          title: `Ending soon: ${assignment.title}`,
          message: `This weekly task closes in under 2 hours.`,
          type: "warning"
        }, nowIso);
      }
    }

    const nextActivation = getNextActivation(weeklyAssignment, now);
    for (const offset of offsets) {
      if (offset === 0) {
        continue;
      }

      const triggerAt = subMinutes(nextActivation, offset);
      const reminderKey = `weekly-upcoming:${assignment.id}:${nextActivation.toISOString()}:${offset}`;
      if (shouldTriggerNow(triggerAt, now)) {
        pushEvent(events, nextReminderLog, existingKeys, {
          reminderKey,
          assignmentId: assignment.id,
          title: `Upcoming weekly task: ${assignment.title}`,
          message: `${assignment.unitName} activates at ${nextActivation.toLocaleString()}.`,
          type: "info"
        }, nowIso);
      }
    }
  }

  return {
    events,
    reminderLog: nextReminderLog
  };
};

export const pruneReminderLog = (entries: ReminderLogEntry[], keepDays = 60): ReminderLogEntry[] => {
  const now = new Date();
  const cutoff = subMinutes(now, keepDays * 24 * 60);
  return entries.filter((entry) => isAfter(parseISO(entry.triggeredAt), cutoff));
};
