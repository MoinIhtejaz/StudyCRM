import {
  addHours,
  addWeeks,
  differenceInHours,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  isThisWeek,
  parseISO,
  set,
  setDay,
  startOfMinute
} from "date-fns";
import type {
  StandardAssignment,
  WeeklyAssignment,
  WeeklyOccurrence
} from "../types/models";

export const URGENT_THRESHOLD_HOURS = 72;
export const WEEKLY_ACTIVE_WINDOW_HOURS = 24;

export const dayOfWeekLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

const parseTime = (value: string): { hours: number; minutes: number } => {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0
  };
};

const applyTime = (date: Date, time: string): Date => {
  const { hours, minutes } = parseTime(time);
  return set(date, {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0
  });
};

export const combineDateAndTime = (dateText: string, timeText: string): string => {
  const combined = applyTime(parseISO(`${dateText}T00:00:00`), timeText);
  return combined.toISOString();
};

export const formatDateTime = (iso: string): string => {
  return format(parseISO(iso), "EEE d MMM, yyyy h:mm a");
};

export const formatDate = (iso: string): string => {
  return format(parseISO(iso), "EEE d MMM yyyy");
};

export const formatTime = (iso: string): string => {
  return format(parseISO(iso), "h:mm a");
};

export const formatActivationTime = (time: string): string => {
  const base = applyTime(new Date(), time);
  return format(base, "h:mm a");
};

const setWeekdayAndTime = (reference: Date, assignment: WeeklyAssignment): Date => {
  const weekDate = setDay(reference, assignment.dayOfWeek, { weekStartsOn: 0 });
  return applyTime(weekDate, assignment.activationTime);
};

export const getMostRecentActivation = (assignment: WeeklyAssignment, now: Date): Date => {
  const candidate = setWeekdayAndTime(now, assignment);
  return isAfter(candidate, now) ? addWeeks(candidate, -1) : candidate;
};

export const getNextActivation = (assignment: WeeklyAssignment, now: Date): Date => {
  const candidate = setWeekdayAndTime(now, assignment);
  return isAfter(candidate, now) ? candidate : addWeeks(candidate, 1);
};

export const getFirstActivationOnOrAfter = (assignment: WeeklyAssignment, from: Date): Date => {
  const start = setWeekdayAndTime(from, assignment);
  return isBefore(start, from) ? addWeeks(start, 1) : start;
};

export const getCycleEnd = (cycleStart: string | Date): Date => {
  const start = typeof cycleStart === "string" ? parseISO(cycleStart) : cycleStart;
  return addHours(start, WEEKLY_ACTIVE_WINDOW_HOURS);
};

export const isStandardOverdue = (assignment: StandardAssignment, now: Date): boolean => {
  if (assignment.isCompleted) {
    return false;
  }

  return isAfter(now, parseISO(assignment.dueAt));
};

export const isStandardUrgent = (assignment: StandardAssignment, now: Date): boolean => {
  if (assignment.isCompleted) {
    return false;
  }

  const due = parseISO(assignment.dueAt);
  const hoursUntilDue = differenceInHours(due, now);
  return hoursUntilDue <= URGENT_THRESHOLD_HOURS && hoursUntilDue >= 0;
};

export const getMinutesRemaining = (iso: string, now: Date): number => {
  return differenceInMinutes(parseISO(iso), now);
};

export const isOccurrenceActiveNow = (occurrence: WeeklyOccurrence, now: Date): boolean => {
  if (occurrence.status !== "active") {
    return false;
  }

  const start = parseISO(occurrence.cycleStartAt);
  const end = parseISO(occurrence.cycleEndAt);
  return (isAfter(now, start) || +now === +start) && isBefore(now, end);
};

export const isDateThisWeek = (iso: string | null): boolean => {
  if (!iso) {
    return false;
  }

  return isThisWeek(parseISO(iso), { weekStartsOn: 1 });
};

export const toMinuteTick = (date: Date): Date => startOfMinute(date);
