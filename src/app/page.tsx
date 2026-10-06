
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
          redirectTo:
            `${window.location.origin}/auth/callback`,
        },
      });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  async function handleEmailAuth(
    event: FormEvent<HTMLFormElement>
  ) {
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
        setError(
          "Password must be at least 6 characters."
        );
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
            emailRedirectTo:
              `${window.location.origin}/auth/callback`,
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
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            `${window.location.origin}/auth/callback`,
        }
      );

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage(
        "Password reset email sent. Check your inbox."
      );
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "linear-gradient(90deg, rgba(0,0,0,.92), rgba(0,0,0,.55)), url('/predator-login-bg.png') center / cover no-repeat",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: "30px",
            background:
              "rgba(5,5,5,.72)",
            borderColor:
              "rgba(255,255,255,.12)",
            boxShadow:
              "0 30px 100px rgba(0,0,0,.55)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "26px",
            }}
          >
            <img
              src="/predator-logo.png"
              alt="PREDATOR"
              style={{
                width: "100px",
                height: "100px",
                objectFit: "contain",
                margin: "0 auto 12px",
              }}
            />

            <h1
              style={{
                fontFamily: "Oxanium, sans-serif",
                fontSize: "28px",
                letterSpacing: "2px",
              }}
            >
              PREDATOR
            </h1>

            <p className="muted">
              Crypto Intelligence & Screener
            </p>
          </div>

          <button
            className="glass-btn"
            onClick={loginWithDiscord}
            disabled={loading}
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "13px",
              borderColor:
                "rgba(239,35,60,.28)",
              background:
                "rgba(239,35,60,.08)",
              marginBottom: "18px",
            }}
          >
            <MessageCircle size={18} />

            {loading
              ? "Connecting..."
              : "Continue with Discord"}
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              margin: "18px 0",
              color: "#666",
              fontSize: "11px",
            }}
          >
            <div
              style={{
                height: "1px",
                flex: 1,
                background:
                  "rgba(255,255,255,.08)",
              }}
            />

            OR

            <div
              style={{
                height: "1px",
                flex: 1,
                background:
                  "rgba(255,255,255,.08)",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <button
              className={
                mode === "login"
                  ? "chip active"
                  : "chip"
              }
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
              style={{
                flex: 1,
              }}
            >
              Login
            </button>

            <button
              className={
                mode === "signup"
                  ? "chip active"
                  : "chip"
              }
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
              style={{
                flex: 1,
              }}
            >
              Create Account
            </button>
          </div>

          <form
            onSubmit={handleEmailAuth}
            className="form-grid"
            style={{
              gridTemplateColumns: "1fr",
              marginTop: 0,
            }}
          >
            {mode === "signup" && (
              <label>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <UserRound size={13} />
                  Name
                </span>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}

            <label>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Mail size={13} />
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <LockKeyhole size={13} />
                Password
              </span>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
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
              className="glass-btn"
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "12px",
              }}
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
              onClick={resetPassword}
              disabled={loading}
              className="text-btn"
              style={{
                width: "100%",
                justifyContent: "center",
                marginTop: "14px",
                padding: "8px",
              }}
            >
              Forgot password?
            </button>
          )}

          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "11px",
                borderRadius: "10px",
                color: "#ff7180",
                background:
                  "rgba(239,35,60,.08)",
                border:
                  "1px solid rgba(239,35,60,.2)",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                marginTop: "16px",
                padding: "11px",
                borderRadius: "10px",
                color: "#65e397",
                background:
                  "rgba(67,209,125,.07)",
                border:
                  "1px solid rgba(67,209,125,.18)",
                fontSize: "12px",
              }}
            >
              {message}
            </div>
          )}

          <p
            className="muted"
            style={{
              textAlign: "center",
              marginTop: "22px",
              lineHeight: 1.6,
            }}
          >
            By continuing, you agree to use
            PREDATOR responsibly.
          </p>
        </div>
      </div>
    </main>
  );
}

function AuthGate() {
  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(
      ({ data }) => {
        if (!mounted) return;

        setUser(data.session?.user ?? null);
        setLoading(false);
      }
    );

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#050505",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <img
            src="/predator-logo.png"
            alt="PREDATOR"
            style={{
              width: "74px",
              height: "74px",
              objectFit: "contain",
            }}
          />

          <p className="muted">
            Loading PREDATOR...
          </p>
        </div>
      </main>
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
