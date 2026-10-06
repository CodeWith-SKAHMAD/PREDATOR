"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { LockKeyhole, Mail, MessageCircle, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PredatorApp from "@/components/PredatorApp";

type AuthMode = "login" | "signup";

function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loginWithDiscord() {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "login") {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) setError(loginError.message);
    } else {
      if (!name.trim()) {
        setError("Please enter your name.");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signupError) {
        setError(signupError.message);
      } else if (!data.session) {
        setMessage("Account created. Check your email to confirm your account.");
      } else {
        setMessage("Account created successfully.");
      }
    }

    setLoading(false);
  }

  async function resetPassword() {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (resetError) setError(resetError.message);
    else setMessage("Password reset email sent. Check your inbox.");

    setLoading(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="glass-card auth-card">
          <div className="auth-brand">
            <img src="/predator-logo.png" alt="PREDATOR" className="auth-logo" />
            <h1>PREDATOR</h1>
            <p className="muted">Crypto Intelligence &amp; Screener</p>
          </div>

          <button className="glass-btn auth-discord" onClick={loginWithDiscord} disabled={loading}>
            <MessageCircle size={18} />
            {loading ? "Connecting..." : "Continue with Discord"}
          </button>

          <div className="auth-divider"><span />OR<span /></div>

          <div className="auth-tabs">
            <button className={mode === "login" ? "chip active" : "chip"} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>
              Login
            </button>
            <button className={mode === "signup" ? "chip active" : "chip"} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>
              Create Account
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="form-grid auth-form-grid">
            {mode === "signup" && (
              <label>
                <span className="input-label"><UserRound size={13} />Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </label>
            )}

            <label>
              <span className="input-label"><Mail size={13} />Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </label>

            <label>
              <span className="input-label"><LockKeyhole size={13} />Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            </label>

            <button className="glass-btn auth-submit" type="submit" disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <button onClick={resetPassword} disabled={loading} className="text-btn auth-forgot">
              Forgot password?
            </button>
          )}

          {error && <div className="auth-message error">{error}</div>}
          {message && <div className="auth-message success">{message}</div>}

          <p className="muted auth-disclaimer">Use PREDATOR responsibly. Market data and signals are informational.</p>
        </div>
      </div>
    </main>
  );
}

function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="auth-loading">
        <img src="/predator-logo.png" alt="PREDATOR" className="auth-loading-logo" />
        <p className="muted">Loading PREDATOR...</p>
      </main>
    );
  }

  return user ? <PredatorApp user={user} /> : <LoginPage />;
}

export default function Home() {
  return <AuthGate />;
}
