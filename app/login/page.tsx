"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const linkBtnStyle: React.CSSProperties = {
  width: "auto",
  background: "none",
  border: "none",
  color: "var(--blue)",
  fontSize: 12,
  fontWeight: 600,
  padding: 0,
  cursor: "pointer",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError("Enter the 6-digit code from the email");
      return;
    }
    setCodeBusy(true);
    setCodeError("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmed,
      type: "email",
    });
    if (error) {
      setCodeBusy(false);
      setCodeError(error.message);
      return;
    }
    // Full reload so the server middleware picks up the new session cookie.
    window.location.assign("/");
  }

  function useDifferentEmail() {
    setSent(false);
    setEmail("");
    setCode("");
    setError("");
    setCodeError("");
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <h2>Welcome to Tracewright</h2>
        {sent ? (
          <>
            <p>
              Check <strong>{email}</strong> for a sign-in link. Open it on
              this device to continue.
            </p>
            <p className="hint" style={{ margin: "-6px 0 16px" }}>
              Link not working? Some email apps open links automatically
              before you click them, which uses up a one-time link. Enter the
              6-digit code from the same email instead — it&apos;s in the
              same message as the link.
            </p>
            <form onSubmit={verifyCode}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                style={{ letterSpacing: "0.2em", textAlign: "center" }}
              />
              <button type="submit" disabled={codeBusy}>
                {codeBusy ? "Verifying…" : "Verify code"}
              </button>
            </form>
            {codeError && (
              <p style={{ color: "var(--red)", marginTop: 12, marginBottom: 0 }}>
                {codeError}
              </p>
            )}
            <button
              type="button"
              onClick={useDifferentEmail}
              style={{ ...linkBtnStyle, marginTop: 16 }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <p>
              Sign in with your work email. We&apos;ll send you a one-time link
              — no password to remember. Your name is attached to every change
              in the shared audit trail.
            </p>
            <form onSubmit={sendLink}>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
            {error && (
              <p style={{ color: "var(--red)", marginTop: 12, marginBottom: 0 }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
