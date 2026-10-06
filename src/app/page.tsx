 "use client";

import { FormEvent, useEffect, useState } from "react";
import {
  LockKeyhole,
  Mail,
  MessageCircle,
  UserRound,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

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

    const { error: oauthError } =
      await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
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
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        setError(loginError.message);
      }
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

      const { data, error: signupError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

      if (signupError) {
        setError(signupError.message);
      } else if (!data.session) {
        setMessage(
          "Account created. Check your email to confirm your account."
        );
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

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("Password reset email sent. Check your inbox.");
    }

    setLoading(false);
  }

  return (
    <div className="login-shell">
      <div className="login-background" aria-hidden="true" />
      <div className="login-overlay" aria-hidden="true" />

      <div className="login-content">
        <div className="login-card">
          <div className="login-brand">
            <img
              src="/predator-logo.png"
              alt="PREDATOR"
              className="login-logo"
            />

            <h1>PREDATOR</h1>

            <p>Crypto Intelligence &amp; Screener</p>
          </div>

          <button
            className="glass-btn discord-btn"
            onClick={loginWithDiscord}
            disabled={loading}
            type="button"
          >
            <MessageCircle size={18} />
            {loading ? "Connecting..." : "Continue with Discord"}
          </button>

          <div className="login-divider">
            <span />
            <b>OR</b>
            <span />
          </div>

          <div className="login-switch">
            <button
              type="button"
              className={mode === "login" ? "chip active" : "chip"}
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={mode === "signup" ? "chip active" : "chip"}
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="login-form">
            {mode === "signup" && (
              <label>
                <span>
                  <UserRound size={13} />
                  Name
                </span>

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}

            <label>
              <span>
                <Mail size={13} />
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label>
              <span>
                <LockKeyhole size={13} />
                Password
              </span>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                required
              />
            </label>

            <button
              className="glass-btn login-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <button
              type="button"
              onClick={resetPassword}
              disabled={loading}
              className="text-btn forgot-btn"
            >
              Forgot password?
            </button>
          )}

          {error && (
            <div className="auth-message error">{error}</div>
          )}

          {message && (
            <div className="auth-message success">{message}</div>
          )}

          <p className="login-note">
            Use PREDATOR responsibly. Market data and signals are
            informational.
          </p>
        </div>
      </div>
    </div>
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

    const { data: authListener } =
      supabase.auth.onAuthStateChange((_event, session) => {
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
      <div className="login-loading">
        <div>
          <img src="/predator-logo.png" alt="PREDATOR" />
          <p>Loading PREDATOR...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <PredatorApp user={user} />;
}

export default function Home() {
  return <AuthGate />;
}
