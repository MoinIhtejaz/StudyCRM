import { useMemo, useState } from "react";
import { REMINDER_PRESETS, formatOffset } from "../lib/reminderOptions";

interface ReminderSelectorProps {
  value: number[];
  onChange: (next: number[]) => void;
}

const normalize = (offsets: number[]): number[] => {
  return [...new Set(offsets)].filter((offset) => offset >= 0).sort((a, b) => b - a);
};

export const ReminderSelector = ({ value, onChange }: ReminderSelectorProps) => {
  const [customMinutes, setCustomMinutes] = useState(15);
  const normalized = useMemo(() => normalize(value), [value]);

  const toggleOffset = (offset: number) => {
    const exists = normalized.includes(offset);
    onChange(exists ? normalized.filter((entry) => entry !== offset) : normalize([...normalized, offset]));
  };

  const addCustomOffset = () => {
    if (!Number.isFinite(customMinutes) || customMinutes < 0) {
      return;
    }

    onChange(normalize([...normalized, customMinutes]));
  };

  const removeOffset = (offset: number) => {
    onChange(normalized.filter((entry) => entry !== offset));
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reminders</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {REMINDER_PRESETS.map((preset) => {
          const checked = normalized.includes(preset.value);
          return (
            <label key={preset.value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOffset(preset.value)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              {preset.label}
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          value={customMinutes}
          onChange={(event) => setCustomMinutes(Number(event.target.value))}
          className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={addCustomOffset}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Add custom offset
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {normalized.map((offset) => (
          <button
            key={offset}
            type="button"
            onClick={() => removeOffset(offset)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
            title="Remove reminder"
          >
            {formatOffset(offset)}
          </button>
        ))}
      </div>
    </div>
  );
};
