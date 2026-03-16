import { addDays, addHours, addWeeks, getDay, set, setDay, subDays, subHours } from "date-fns";
import { createId } from "../lib/id";
import type {
  Assignment,
  Category,
  ReminderLogEntry,
  StudySnapshot,
  WeeklyOccurrence
} from "../types/models";

const now = new Date();

const iso = (date: Date): string => date.toISOString();

const createCategory = (name: string, color: string): Category => {
  const timestamp = iso(now);
  return {
    id: createId(),
    name,
    color,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

const toTime = (date: Date): string => {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const toCycleDate = (dayOfWeek: number, time: string, reference: Date, weeksDelta: number): Date => {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  const weekAnchor = setDay(reference, dayOfWeek, { weekStartsOn: 0 });
  const withTime = set(weekAnchor, { hours, minutes, seconds: 0, milliseconds: 0 });
  return addWeeks(withTime, weeksDelta);
};

const categoryPalette: Record<string, string> = {
  Exam: "#b91c1c",
  Quiz: "#c2410c",
  Lab: "#0369a1",
  Tutorial: "#0f766e",
  Project: "#334155",
  Reading: "#166534",
  Submission: "#7c3aed",
  Admin: "#6b7280",
  "Personal Study": "#be185d"
};

const categories = Object.entries(categoryPalette).map(([name, color]) => createCategory(name, color));
const categoryByName = new Map(categories.map((category) => [category.name, category]));

const assignmentTimestamp = iso(subDays(now, 18));

const baseAssignment = {
  createdAt: assignmentTimestamp,
  updatedAt: iso(now),
  description: "",
  reminderOffsetsInMinutes: [1440, 360, 30]
};

const urgentDue = addHours(now, 40);
const normalDue = addDays(now, 5);
const overdueDue = subDays(now, 1);
const completedDue = subDays(now, 4);

const activeWeeklyStart = set(subHours(now, 2), {
  seconds: 0,
  milliseconds: 0
});
const activeWeeklyTime = toTime(activeWeeklyStart);
const activeWeeklyDay = getDay(activeWeeklyStart);

const tutorialWeeklyDay = (getDay(now) + 1) % 7;
const tutorialWeeklyTime = "09:00";
const discussionWeeklyDay = (getDay(now) + 5) % 7;
const discussionWeeklyTime = "08:30";

const assignments: Assignment[] = [
  {
    ...baseAssignment,
    id: createId(),
    type: "standard",
    title: "Database Systems Essay Draft",
    unitName: "COMP3400",
    categoryId: categoryByName.get("Project")?.id ?? null,
    categoryName: "Project",
    description: "Draft 1,500 words and include three journal references.",
    dueAt: iso(normalDue),
    status: "in_progress",
    isCompleted: false,
    completedAt: null
  },
  {
    ...baseAssignment,
    id: createId(),
    type: "standard",
    title: "Operating Systems Quiz 4",
    unitName: "COMP2301",
    categoryId: categoryByName.get("Quiz")?.id ?? null,
    categoryName: "Quiz",
    description: "Closed-book online quiz with 25 MCQs.",
    dueAt: iso(urgentDue),
    status: "pending",
    isCompleted: false,
    completedAt: null
  },
  {
    ...baseAssignment,
    id: createId(),
    type: "standard",
    title: "Chemistry Lab Report",
    unitName: "CHEM1202",
    categoryId: categoryByName.get("Lab")?.id ?? null,
    categoryName: "Lab",
    description: "Write-up for titration experiment including calculations.",
    dueAt: iso(overdueDue),
    status: "pending",
    isCompleted: false,
    completedAt: null
  },
  {
    ...baseAssignment,
    id: createId(),
    type: "standard",
    title: "Linear Algebra Worksheet",
    unitName: "MATH2101",
    categoryId: categoryByName.get("Tutorial")?.id ?? null,
    categoryName: "Tutorial",
    description: "Submitted via LMS.",
    dueAt: iso(completedDue),
    status: "completed",
    isCompleted: true,
    completedAt: iso(subDays(now, 2)),
    reminderOffsetsInMinutes: [1440, 60]
  },
  {
    ...baseAssignment,
    id: createId(),
    type: "weekly",
    title: "Reading Reflection Log",
    unitName: "EDUC1100",
    categoryId: categoryByName.get("Reading")?.id ?? null,
    categoryName: "Reading",
    description: "Submit one reflection paragraph after reading this week.",
    dayOfWeek: activeWeeklyDay,
    activationTime: activeWeeklyTime,
    isActive: true,
    reminderOffsetsInMinutes: [60, 0]
  },
  {
    ...baseAssignment,
    id: createId(),
    type: "weekly",
    title: "Tutorial Problem Set",
    unitName: "COMP2210",
    categoryId: categoryByName.get("Tutorial")?.id ?? null,
    categoryName: "Tutorial",
    description: "Complete the weekly tutorial worksheet.",
    dayOfWeek: tutorialWeeklyDay,
    activationTime: tutorialWeeklyTime,
    isActive: true,
    reminderOffsetsInMinutes: [1440, 60, 0]
  },
  {
    ...baseAssignment,
    id: createId(),
    type: "weekly",
    title: "Discussion Board Post",
    unitName: "SOCI1003",
    categoryId: categoryByName.get("Submission")?.id ?? null,
    categoryName: "Submission",
    description: "Post one argument and one peer reply each week.",
    dayOfWeek: discussionWeeklyDay,
    activationTime: discussionWeeklyTime,
    isActive: true,
    reminderOffsetsInMinutes: [180, 30, 0]
  }
];

const weeklyByTitle = new Map(
  assignments
    .filter((assignment): assignment is Extract<Assignment, { type: "weekly" }> => assignment.type === "weekly")
    .map((assignment) => [assignment.title, assignment])
);

const readingWeekly = weeklyByTitle.get("Reading Reflection Log");
const tutorialWeekly = weeklyByTitle.get("Tutorial Problem Set");
const discussionWeekly = weeklyByTitle.get("Discussion Board Post");

const occurrences: WeeklyOccurrence[] = [];

if (readingWeekly) {
  const cycleStart = toCycleDate(readingWeekly.dayOfWeek, readingWeekly.activationTime, now, 0);
  occurrences.push({
    id: createId(),
    assignmentId: readingWeekly.id,
    cycleStartAt: iso(cycleStart),
    cycleEndAt: iso(addHours(cycleStart, 24)),
    status: "active",
    completedAt: null,
    missedAt: null,
    createdAt: iso(subHours(now, 2)),
    updatedAt: iso(now)
  });

  const lastWeekCycle = toCycleDate(readingWeekly.dayOfWeek, readingWeekly.activationTime, now, -1);
  occurrences.push({
    id: createId(),
    assignmentId: readingWeekly.id,
    cycleStartAt: iso(lastWeekCycle),
    cycleEndAt: iso(addHours(lastWeekCycle, 24)),
    status: "completed",
    completedAt: iso(addHours(lastWeekCycle, 6)),
    missedAt: null,
    createdAt: iso(lastWeekCycle),
    updatedAt: iso(addHours(lastWeekCycle, 6))
  });
}

if (tutorialWeekly) {
  const lastWeekCycle = toCycleDate(tutorialWeekly.dayOfWeek, tutorialWeekly.activationTime, now, -1);
  occurrences.push({
    id: createId(),
    assignmentId: tutorialWeekly.id,
    cycleStartAt: iso(lastWeekCycle),
    cycleEndAt: iso(addHours(lastWeekCycle, 24)),
    status: "completed",
    completedAt: iso(addHours(lastWeekCycle, 7)),
    missedAt: null,
    createdAt: iso(lastWeekCycle),
    updatedAt: iso(addHours(lastWeekCycle, 7))
  });
}

if (discussionWeekly) {
  const previousCycle = toCycleDate(discussionWeekly.dayOfWeek, discussionWeekly.activationTime, now, -1);
  const missedAt = addHours(previousCycle, 24);
  occurrences.push({
    id: createId(),
    assignmentId: discussionWeekly.id,
    cycleStartAt: iso(previousCycle),
    cycleEndAt: iso(missedAt),
    status: "missed",
    completedAt: null,
    missedAt: iso(missedAt),
    createdAt: iso(previousCycle),
    updatedAt: iso(missedAt)
  });
}

const reminderLog: ReminderLogEntry[] = [];

export const createSeedSnapshot = (): StudySnapshot => ({
  categories,
  assignments,
  occurrences,
  reminderLog
});
