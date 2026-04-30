# Supabase Setup

1. Open the Supabase project SQL editor for `https://snkhepqpaxtfsrdtlkpx.supabase.co`.
2. Paste and run `supabase/schema.sql`.
3. Confirm the public anon key in `js/supabase-client.js` matches the key in Project Settings > API.
4. Refresh the local site after the schema finishes.

The current schema uses permissive RLS policies because this is a static browser app with dashboard writes from the anon client. Before production, replace those policies with Supabase Auth based admin/user roles or server-side Edge Functions.
