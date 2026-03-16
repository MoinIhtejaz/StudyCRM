export const REMINDER_PRESETS = [
  { label: "3 days before", value: 4320 },
  { label: "1 day before", value: 1440 },
  { label: "6 hours before", value: 360 },
  { label: "30 minutes before", value: 30 },
  { label: "At activation / due time", value: 0 }
] as const;

export const formatOffset = (minutes: number): string => {
  if (minutes === 0) {
    return "At activation / due time";
  }

  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days > 1 ? "s" : ""} before`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours > 1 ? "s" : ""} before`;
  }

  return `${minutes} minutes before`;
};
