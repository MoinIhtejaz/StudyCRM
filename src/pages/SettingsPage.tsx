import { useState } from "react";
import { ReminderSelector } from "../components/ReminderSelector";
import type { AppSettings, StorageMode } from "../types/models";

interface SettingsPageProps {
  storageMode: StorageMode;
  timezoneLabel: string;
  generatedAtLabel: string;
  settings: AppSettings;
  canUseNotifications: boolean;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => Promise<NotificationPermission>;
  onSaveSettings: (settings: AppSettings) => void;
}

export const SettingsPage = ({
  storageMode,
  timezoneLabel,
  generatedAtLabel,
  settings,
  canUseNotifications,
  notificationPermission,
  onRequestNotificationPermission,
  onSaveSettings
}: SettingsPageProps) => {
  const [draftOffsets, setDraftOffsets] = useState(settings.defaultReminderOffsetsInMinutes);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Timezone</p>
            <p className="mt-1 font-medium text-slate-900">{timezoneLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Storage mode</p>
            <p className="mt-1 font-medium text-slate-900">Supabase mode</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Notification API</p>
            <p className="mt-1 font-medium text-slate-900">
              {canUseNotifications ? "Supported" : "Not supported in this browser"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Permission status</p>
            <p className="mt-1 font-medium text-slate-900">{notificationPermission}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onRequestNotificationPermission()}
            className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Request browser notifications
          </button>
          <p className="text-sm text-slate-600">Last rendered: {generatedAtLabel}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Default reminder options</h3>
        <p className="mt-1 text-sm text-slate-600">
          These defaults are applied when creating a new assignment.
        </p>

        <div className="mt-4">
          <ReminderSelector value={draftOffsets} onChange={setDraftOffsets} />
        </div>

        <button
          type="button"
          onClick={() => onSaveSettings({ defaultReminderOffsetsInMinutes: draftOffsets })}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save default reminders
        </button>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="text-base font-semibold text-amber-900">Notification limitations</h3>
        <p className="mt-2 text-sm text-amber-900">
          In-app banners and browser notifications are reliable while this app tab is open. True background reminders
          while the app is closed are not guaranteed without backend scheduling.
        </p>
      </section>
    </div>
  );
};
