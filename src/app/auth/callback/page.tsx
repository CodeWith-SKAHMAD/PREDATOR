"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function finishAuthentication() {
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      }

      router.replace("/");
    }

    finishAuthentication();
    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <main className="auth-loading">
        <div className="glass-card auth-error-card">
          <img src="/predator-logo.png" alt="PREDATOR" className="auth-loading-logo" />
          <h2>Authentication failed</h2>
          <p className="muted">{error}</p>
          <button className="glass-btn" onClick={() => router.replace("/")}>Back to Login</button>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-loading">
      <img src="/predator-logo.png" alt="PREDATOR" className="auth-loading-logo" />
      <p className="muted">Signing you in...</p>
    </main>
  );
}
