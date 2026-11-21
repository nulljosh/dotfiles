---
name: quick-auth
description: Single-user private app pattern — Supabase email+password auth, data kept out of git (Supabase table instead of hardcoded), and a read-only opaque-token deep link for sharing/scraping without exposing credentials. Use when wiring auth for a personal tool (web/iOS/macOS) instead of re-deriving it each time.
---

# Quick auth for single-user private tools

Pattern used in `brief` (Trommel litigation tool). Reuse for Tally/Spark/similar
single-user apps instead of designing auth from scratch.

## Identity
- Supabase email+password, hard-checked against one allowed email before showing
  the password step (no signup flow needed for a single user).
- Reuse a shared Supabase project across apps (e.g. `spark`) instead of creating a
  new project per app — Supabase free tier caps at 2 projects per org.

## Data
- Never hardcode sensitive content (case facts, contacts, secrets) in source files.
- Store it as `{ user_id, key, value jsonb }` rows in one table (e.g. `app_data`),
  RLS policy `auth.uid() = user_id`.
- Fetch after sign-in, destructure into the same variable names the UI already uses
  — minimal rewrite of existing render code.

## Read-only share links
- Don't use a 4-digit PIN or any client-checked secret — it's visible in source and
  guessable.
- Instead: a Postgres `SECURITY DEFINER` RPC, anon-callable, that takes a long
  random token (32+ chars) and returns the data only if the token matches a row
  stored server-side. The token itself is safe to paste into a URL, bookmark, or
  hand to an LLM — it grants read-only access to one table, nothing else.

```sql
create or replace function get_data_by_token(p_token text)
returns jsonb language plpgsql security definer as $$
declare result jsonb;
begin
  select value into result from app_data
  where key = 'main' and user_id = (
    select user_id from app_data where key = 'scrape_token' and value = to_jsonb(p_token)
  );
  return result;
end; $$;
grant execute on function get_data_by_token(text) to anon;
```

## Session longevity
- Supabase JS persists sessions to localStorage by default — no extra work needed
  for "stay logged in" on web.
- iOS/macOS: persist the refresh token in Keychain (not yet wired for `brief`,
  follow-up item) and gate reopen with the local biometric lock pattern already in
  `brief/ios/Sources/Views/BiometricLockView.swift` — Face ID/Touch ID just unlocks
  the cached session, no network round trip.

## Repo hygiene
- If sensitive data ever got committed to a public repo's history, `git filter-repo
  --path <dir> --invert-paths --force` then force-push cleans it. Back up the repo
  locally first.
