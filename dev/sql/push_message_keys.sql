-- Notifications that say what is needed (not just "open the app") — run once in Supabase → SQL Editor.
-- Each phone keeps its message keys next to its subscription; the app fills them in by itself the next time it opens.
alter table public.push_subs add column if not exists p256dh text;
alter table public.push_subs add column if not exists auth text;
