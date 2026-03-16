import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { WeeklyPage } from "./pages/WeeklyPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AuthPage } from "./pages/AuthPage";
import { useStudyCRM } from "./hooks/useStudyCRM";
import { useSupabaseAuth } from "./hooks/useSupabaseAuth";
import { useToasts } from "./hooks/useToasts";
import { useBrowserNotifications } from "./hooks/useBrowserNotifications";
import { getActiveWeeklyTasks } from "./lib/weeklyEngine";
import { isDateThisWeek, isStandardOverdue, isStandardUrgent } from "./lib/dateUtils";
import { userToSid } from "./lib/auth";
import type { Assignment } from "./types/models";
import { ToastViewport } from "./components/ToastViewport";

const navigationItems = [
  { to: "/", label: "Dashboard" },
  { to: "/assignments", label: "Assignments" },
  { to: "/weekly", label: "Weekly" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" }
];

const navClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

const standardAssignments = (assignments: Assignment[]) =>
  assignments.filter(
    (assignment): assignment is Extract<Assignment, { type: "standard" }> => assignment.type === "standard"
  );

export default function App() {
  const auth = useSupabaseAuth();
  const study = useStudyCRM(Boolean(auth.session));
  const toasts = useToasts();
  const notifications = useBrowserNotifications();
  const [now, setNow] = useState(() => new Date());
  const activeSid = userToSid(auth.user?.email, auth.user?.user_metadata?.sid as string | undefined);
  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      toasts.pushToast({
        title: "Sign out failed",
        message: error instanceof Error ? error.message : "Unable to sign out.",
        type: "error"
      });
    }
  };

  useEffect(() => {
    if (!auth.session || study.loading) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) {
        return;
      }

      setNow(new Date());
      const events = await study.runMaintenance();
      if (cancelled) {
        return;
      }

      for (const event of events) {
        toasts.pushToast({
          title: event.title,
          message: event.message,
          type: event.type === "warning" ? "warning" : "info"
        });

        notifications.notify(event.title, event.message);
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [auth.session, study.loading, study.runMaintenance, notifications, toasts]);

  useEffect(() => {
    if (!study.error) {
      return;
    }

    toasts.pushToast({
      title: "Storage notice",
      message: study.error,
      type: "warning"
    });
  }, [study.error, toasts]);

  useEffect(() => {
    if (!auth.error) {
      return;
    }

    toasts.pushToast({
      title: "Auth notice",
      message: auth.error,
      type: "warning"
    });
  }, [auth.error, toasts]);

  const standards = useMemo(() => standardAssignments(study.snapshot.assignments), [study.snapshot.assignments]);
  const openStandards = useMemo(() => standards.filter((assignment) => !assignment.isCompleted), [standards]);

  const urgentCount = useMemo(
    () => openStandards.filter((assignment) => isStandardUrgent(assignment, now)).length,
    [openStandards, now]
  );

  const overdueCount = useMemo(
    () => openStandards.filter((assignment) => isStandardOverdue(assignment, now)).length,
    [openStandards, now]
  );

  const activeWeeklyTasks = useMemo(
    () =>
      getActiveWeeklyTasks(
        study.snapshot.assignments,
        study.snapshot.occurrences,
        now.toISOString()
      ),
    [study.snapshot.assignments, study.snapshot.occurrences, now]
  );

  const completedThisWeek = useMemo(() => {
    const standardCompleted = standards.filter((assignment) => isDateThisWeek(assignment.completedAt)).length;
    const weeklyCompleted = study.snapshot.occurrences.filter(
      (occurrence) => occurrence.status === "completed" && isDateThisWeek(occurrence.completedAt)
    ).length;
    return standardCompleted + weeklyCompleted;
  }, [standards, study.snapshot.occurrences]);

  const summaryCards = useMemo(
    () => [
      { label: "Active assignments", value: openStandards.length + activeWeeklyTasks.length, tone: "neutral" as const },
      { label: "Urgent assignments", value: urgentCount, tone: "urgent" as const },
      { label: "Overdue assignments", value: overdueCount, tone: "overdue" as const },
      { label: "Active weekly tasks", value: activeWeeklyTasks.length, tone: "active" as const },
      { label: "Completed this week", value: completedThisWeek, tone: "completed" as const }
    ],
    [openStandards.length, activeWeeklyTasks.length, urgentCount, overdueCount, completedThisWeek]
  );

  if (auth.loading || (auth.session && study.loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Loading StudyCRM...
        </div>
      </div>
    );
  }

  if (!auth.isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-xl rounded-2xl border border-rose-300 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Supabase is not configured</h1>
          <p className="mt-2 text-sm text-slate-700">
            Add environment keys to continue:
          </p>
          <pre className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{`VITE_STORAGE_MODE=supabase\nVITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...`}</pre>
        </div>
      </div>
    );
  }

  if (!auth.session) {
    return (
      <>
        <AuthPage onSignIn={auth.signIn} onSignUp={auth.signUp} />
        <ToastViewport toasts={toasts.toasts} onDismiss={toasts.removeToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.14),_transparent_45%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">StudyCRM</h1>
              <p className="mt-1 text-sm text-slate-600">
                Assignment visibility, urgency tracking, and weekly recurring task control.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Storage: Supabase
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                SID: {activeSid}
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            {navigationItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClassName} end={item.to === "/"}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {study.error ? (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {study.error}
            </div>
          ) : null}
        </header>

        <main className="pb-10">
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  now={now}
                  openStandardAssignments={openStandards}
                  activeWeeklyTasks={activeWeeklyTasks}
                  summaryCards={summaryCards}
                  onCompleteStandard={(assignmentId) => study.toggleStandardCompletion(assignmentId, true)}
                  onCompleteWeekly={study.completeWeeklyOccurrence}
                />
              }
            />
            <Route
              path="/assignments"
              element={
                <AssignmentsPage
                  assignments={study.snapshot.assignments}
                  categories={study.snapshot.categories}
                  defaultReminderOffsetsInMinutes={study.settings.defaultReminderOffsetsInMinutes}
                  onSaveAssignment={study.saveAssignment}
                  onDeleteAssignment={study.removeAssignment}
                  onToggleStandardCompletion={study.toggleStandardCompletion}
                />
              }
            />
            <Route
              path="/weekly"
              element={
                <WeeklyPage
                  assignments={study.snapshot.assignments}
                  occurrences={study.snapshot.occurrences}
                  activeWeeklyTasks={activeWeeklyTasks}
                  onCompleteWeekly={study.completeWeeklyOccurrence}
                />
              }
            />
            <Route
              path="/history"
              element={
                <HistoryPage
                  assignments={study.snapshot.assignments}
                  occurrences={study.snapshot.occurrences}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  storageMode={study.storageMode}
                  timezoneLabel={study.timezoneLabel}
                  generatedAtLabel={study.generatedAtLabel}
                  settings={study.settings}
                  canUseNotifications={notifications.canUseNotifications}
                  notificationPermission={notifications.permission}
                  onRequestNotificationPermission={notifications.requestPermission}
                  onSaveSettings={study.saveSettings}
                />
              }
            />
          </Routes>
        </main>
      </div>

      <ToastViewport toasts={toasts.toasts} onDismiss={toasts.removeToast} />
    </div>
  );
}
