# Database migrations

**Every schema change goes through a migration file and `supabase db push` — never the Supabase dashboard's SQL editor.** Before this was written, only one migration was ever tracked (`create_kv_table_48182530`); everything else was applied ad hoc through the SQL editor, so the migration history didn't reflect what was actually in the database. See `supabase/migrations_archive/` for an example of what that leaves behind: a SQL file that was never actually run through the CLI, sitting untracked with no record of its real status.

## One-time setup (per machine)

The CLI needs a personal access token to act on your behalf (separate from the project's API keys in `.env.local`):

1. Generate one at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Export it for your shell session: `export SUPABASE_ACCESS_TOKEN="sbp_..."`

The project is already linked (see `supabase/config.toml`), so no `supabase link` step is needed once the token is set.

## Making a schema change

```bash
# 1. Scaffold a correctly-named, timestamped migration file
npx supabase migration new short_description_of_change

# 2. Write the SQL in the generated file under supabase/migrations/

# 3. Preview what would run, against the real remote database
npx supabase db push --linked --dry-run

# 4. Apply it
npx supabase db push --linked

# 5. Commit the migration file to git
```

## Checking migration state

```bash
npx supabase migration list --linked
```

`local` and `remote` should always show the same set of timestamps. If they diverge (e.g. someone changed the schema through the dashboard instead of a migration), `db push` will refuse to run until it's reconciled - see the `supabase migration repair` command, or reconstruct the missing local file if you know what the drift was (as done for `20260425203601_create_kv_table_48182530.sql`).

## Running read-only queries

For quick checks against the live database without a full DB password / psql setup:

```bash
npx supabase db query --linked "SELECT count(*) FROM locations;"
```

This goes through the Management API rather than a direct Postgres connection, so it works with just the access token.
