# Tracewright — RTM Builder

Tender · requirement · UAT traceability. Next.js (App Router) + TypeScript + Tailwind, backed by Supabase.

## Environment variables

Set these in Vercel (Project → Settings → Environment Variables) for **Production, Preview and Development**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xjyxocuvycvhsjncuobk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase → Project Settings → API>
```

Locally, put the same two lines in `.env.local` (git-ignored).

## Supabase

Schema already applied to the shared project — all tables are prefixed `tw_`:

`tw_profiles`, `tw_projects`, `tw_documents`, `tw_clauses`, `tw_doc_versions`,
`tw_links`, `tw_link_clauses`, `tw_gap_meta`, `tw_audit_log`

RLS is on for every table: any signed-in user has full access (shared org workspace),
anon has none. `tw_audit_log` is append-only (no update/delete policy).

Auth is Supabase magic link. Add your deployed URL to
Supabase → Authentication → URL Configuration → Redirect URLs:

```
https://<your-domain>/auth/callback
```

## Local dev

```bash
npm install
npm run dev
```

## Layout

- `app/` — routes; `api/auto-suggest` and `api/sample-data` are server-side
- `components/` — `AppShell` plus one component per tab, modals under `modals/`
- `lib/` — `api.ts` (Supabase data layer), `derive.ts` (status/gap logic),
  `matching.ts` (auto-suggest heuristic, shared with the API route),
  `export.ts` (xlsx), `parse.ts` (CSV/xlsx import)
