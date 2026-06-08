# Mongkol Wela Supabase

This folder contains the production database contract for Mongkol Wela.

## Environment

Public/browser-safe values:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Server-only value:

- `SUPABASE_SERVICE_ROLE_KEY`

Never commit the service role key. Rotate it if it has ever appeared in chat,
logs, screenshots, or local shell history.

## Apply Schema

Use one of these paths:

1. Supabase Dashboard -> SQL Editor -> paste
   `supabase/migrations/20260608000000_initial_mongkolwela.sql` -> Run.
2. Supabase CLI after linking the project:

```bash
supabase db push
```

## Seed Data

After the schema exists and `SUPABASE_SERVICE_ROLE_KEY` is available locally:

```bash
npm run db:seed
```

The seed imports:

- current live/default Admin CMS document
- `src/data/popular-temples.json`
- `src/data/mu-temples.json`
- `src/data/sacred-temples.json`

The website still keeps GitHub JSON as a snapshot/fallback. Once the database is
fully populated, production Admin publishing writes Supabase first when the
service role key is configured, and still commits the JSON snapshot to GitHub.
