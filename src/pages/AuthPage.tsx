import { useState } from "react";

interface AuthPageProps {
  onSignIn: (sid: string, password: string) => Promise<void>;
  onSignUp: (sid: string, password: string) => Promise<void>;
}

export const AuthPage = ({ onSignIn, onSignUp }: AuthPageProps) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [sid, setSid] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanSid = sid.trim();
    if (!/^[0-9]{9}$/.test(cleanSid)) {
      setError("SID must be exactly 9 digits.");
      return;
    }

    if (mode === "signup" && !/^.{10,}$/.test(password)) {
      setError("Password must be at least 10 characters for new accounts.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      if (mode === "login") {
        await onSignIn(cleanSid, password);
      } else {
        await onSignUp(cleanSid, password);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Authentication failed.";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16),_transparent_48%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] px-4 py-10">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">StudyCRM</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with your SID to access your own assignment workspace.
        </p>

        <div className="mt-5 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
              mode === "login" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
              mode === "signup" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Create account
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">SID (9 digits)</span>
            <input
              value={sid}
              onChange={(event) => setSid(event.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
              placeholder="e.g. 123456789"
              inputMode="numeric"
              pattern="[0-9]{9}"
              maxLength={9}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              autoComplete="username"
              required
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>

          {mode === "signup" ? (
            <>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Use at least 10 characters with uppercase, lowercase, number, and symbol.
              </p>
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700">Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  autoComplete="new-password"
                  required
                />
              </label>
            </>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
          >
            {isBusy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
};
