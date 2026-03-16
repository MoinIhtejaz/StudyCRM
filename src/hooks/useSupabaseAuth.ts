import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseClient } from "../lib/supabase";
import { isStrongPassword, isValidSid, normalizeSid, sidToEmail } from "../lib/auth";

const mapAuthError = (message: string, isSignup = false): string => {
  const lower = message.toLowerCase();

  if (lower.includes("rate limit")) {
    return isSignup
      ? "Signup is temporarily rate-limited by Supabase. If this SID was already created, switch to Login now. For SID-only flow, disable email confirmation in Supabase Auth settings."
      : "Too many auth attempts. Please wait a moment and try again.";
  }

  if (lower.includes("already registered") || lower.includes("user already registered")) {
    return "This SID already has an account. Please use Login.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Invalid SID or password.";
  }

  return message;
};

export const useSupabaseAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseClient) {
      setLoading(false);
      setError("Supabase environment variables are missing.");
      return;
    }
    const client = supabaseClient;

    let mounted = true;

    const load = async () => {
      const { data, error: sessionError } = await client.auth.getSession();
      if (!mounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    void load();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (sid: string, password: string): Promise<void> => {
    if (!supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    const client = supabaseClient;

    const cleanSid = normalizeSid(sid);
    if (!isValidSid(cleanSid)) {
      throw new Error("SID must be exactly 9 digits.");
    }

    const { error: signInError } = await client.auth.signInWithPassword({
      email: sidToEmail(cleanSid),
      password
    });

    if (signInError) {
      throw new Error(mapAuthError(signInError.message));
    }
  }, []);

  const signUp = useCallback(async (sid: string, password: string): Promise<void> => {
    if (!supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    const client = supabaseClient;

    const cleanSid = normalizeSid(sid);
    if (!isValidSid(cleanSid)) {
      throw new Error("SID must be exactly 9 digits.");
    }

    if (!isStrongPassword(password)) {
      throw new Error(
        "Use a stronger password (min 10 chars with uppercase, lowercase, number, and symbol)."
      );
    }

    const { data, error: signUpError } = await client.auth.signUp({
      email: sidToEmail(cleanSid),
      password,
      options: {
        data: {
          sid: cleanSid
        }
      }
    });

    if (signUpError) {
      const lower = signUpError.message.toLowerCase();

      if (lower.includes("rate limit")) {
        const signInAttempt = await client.auth.signInWithPassword({
          email: sidToEmail(cleanSid),
          password
        });

        if (!signInAttempt.error) {
          return;
        }
      }

      throw new Error(mapAuthError(signUpError.message, true));
    }

    if (data.user && !data.session) {
      throw new Error("Account created. Disable email confirmation in Supabase Auth, then sign in.");
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabaseClient) {
      return;
    }
    const client = supabaseClient;

    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      throw new Error(mapAuthError(signOutError.message));
    }
  }, []);

  return useMemo(
    () => ({
      isConfigured: Boolean(supabaseClient),
      session,
      user,
      loading,
      error,
      signIn,
      signUp,
      signOut
    }),
    [session, user, loading, error, signIn, signUp, signOut]
  );
};
