"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="gate">
      <div className="gate-card">
        <h2>Welcome to Tracewright</h2>
        {sent ? (
          <p>
            Check <strong>{email}</strong> for a sign-in link. Open it on this
            device to continue.
          </p>
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
