import { addWeeks, isAfter, isBefore, parseISO } from "date-fns";
import { createId } from "./id";
import {
  getCycleEnd,
  getFirstActivationOnOrAfter,
  getMinutesRemaining,
  getMostRecentActivation,
  isOccurrenceActiveNow
} from "./dateUtils";
import type {
  ActiveWeeklyTask,
  Assignment,
  WeeklyAssignment,
  WeeklyOccurrence
} from "../types/models";

interface ReconcileResult {
  occurrences: WeeklyOccurrence[];
  changed: boolean;
  newlyMissed: WeeklyOccurrence[];
}

const toOccurrenceKey = (assignmentId: string, cycleStartAt: string): string =>
  `${assignmentId}::${cycleStartAt}`;

const cloneOccurrence = (occurrence: WeeklyOccurrence): WeeklyOccurrence => ({ ...occurrence });

export const reconcileWeeklyOccurrences = (
  assignments: Assignment[],
  occurrences: WeeklyOccurrence[],
  nowIso: string
): ReconcileResult => {
  const now = parseISO(nowIso);
  const weeklyAssignments = assignments.filter(
    (assignment): assignment is WeeklyAssignment => assignment.type === "weekly"
  );

  const nextOccurrences = occurrences.map(cloneOccurrence);
  const occurrenceIndex = new Map<string, WeeklyOccurrence>();
  const newlyMissed: WeeklyOccurrence[] = [];

  for (const occurrence of nextOccurrences) {
    occurrenceIndex.set(toOccurrenceKey(occurrence.assignmentId, occurrence.cycleStartAt), occurrence);
  }

  let changed = false;

  for (const occurrence of nextOccurrences) {
    if (occurrence.status !== "active") {
      continue;
    }

    const cycleEnd = parseISO(occurrence.cycleEndAt);
    if (isAfter(now, cycleEnd)) {
      occurrence.status = "missed";
      occurrence.missedAt = cycleEnd.toISOString();
      occurrence.updatedAt = now.toISOString();
      changed = true;
      newlyMissed.push(occurrence);
    }
  }

  for (const assignment of weeklyAssignments) {
    if (!assignment.isActive) {
      continue;
    }

    const createdAt = parseISO(assignment.createdAt);
    const latestCycle = getMostRecentActivation(assignment, now);
    const defaultFirstCycle = getFirstActivationOnOrAfter(assignment, createdAt);
    const latestCycleEnd = getCycleEnd(latestCycle);

    // If the assignment was created after this cycle started but before the
    // 24-hour window closes, activate it immediately for the current cycle.
    const createdDuringCurrentWindow =
      isAfter(createdAt, latestCycle) && isBefore(createdAt, latestCycleEnd);

    const firstCycle = createdDuringCurrentWindow ? latestCycle : defaultFirstCycle;

    if (isAfter(firstCycle, latestCycle)) {
      continue;
    }

    let cursor = firstCycle;
    let guard = 0;

    while (!isAfter(cursor, latestCycle) && guard < 520) {
      const cycleStartIso = cursor.toISOString();
      const key = toOccurrenceKey(assignment.id, cycleStartIso);
      const existing = occurrenceIndex.get(key);
      const cycleEnd = getCycleEnd(cursor);

      if (!existing) {
        const nowBeforeEnd = !isAfter(now, cycleEnd);
        const occurrence: WeeklyOccurrence = {
          id: createId(),
          assignmentId: assignment.id,
          cycleStartAt: cycleStartIso,
          cycleEndAt: cycleEnd.toISOString(),
          status: nowBeforeEnd ? "active" : "missed",
          completedAt: null,
          missedAt: nowBeforeEnd ? null : cycleEnd.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };

        nextOccurrences.push(occurrence);
        occurrenceIndex.set(key, occurrence);
        changed = true;

        if (occurrence.status === "missed") {
          newlyMissed.push(occurrence);
        }
      }

      cursor = addWeeks(cursor, 1);
      guard += 1;
    }
  }

  return {
    occurrences: nextOccurrences.sort((a, b) => +parseISO(b.cycleStartAt) - +parseISO(a.cycleStartAt)),
    changed,
    newlyMissed
  };
};

export const getActiveWeeklyTasks = (
  assignments: Assignment[],
  occurrences: WeeklyOccurrence[],
  nowIso: string
): ActiveWeeklyTask[] => {
  const now = parseISO(nowIso);
  const weeklyById = new Map(
    assignments
      .filter((assignment): assignment is WeeklyAssignment => assignment.type === "weekly" && assignment.isActive)
      .map((assignment) => [assignment.id, assignment])
  );

  return occurrences
    .filter((occurrence) => weeklyById.has(occurrence.assignmentId) && isOccurrenceActiveNow(occurrence, now))
    .map((occurrence) => {
      const assignment = weeklyById.get(occurrence.assignmentId) as WeeklyAssignment;
      const remainingMinutes = getMinutesRemaining(occurrence.cycleEndAt, now);

      return {
        assignment,
        occurrence,
        remainingMinutes,
        isClosingSoon: remainingMinutes <= 120
      };
    })
    .sort((a, b) => a.remainingMinutes - b.remainingMinutes);
};
