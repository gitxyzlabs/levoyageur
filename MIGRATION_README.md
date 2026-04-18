# Database Migration: Fix Default Ratings

## Issue
Your database currently has `DEFAULT 0` constraints on rating columns, which means when users favorite a location without rating it, the database automatically sets the score to `0` instead of `null`.

## Solution
Run the migration SQL to:
1. Remove `DEFAULT 0` constraints
2. Allow `NULL` values for ratings
3. Optionally clean up existing `0` values

## How to Apply

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Run the Migration
Copy and paste the contents of `/MIGRATION_FIX_DEFAULT_RATINGS.sql` and click **Run**.

### Step 3: Verify
After running, test by favoriting a location without rating it. The LV scores should now be `null` instead of `0`.

## What This Changes

### Before Migration:
```sql
lv_editors_score DECIMAL(5,2) DEFAULT 0  -- ❌ Forces 0 on new rows
lv_crowdsource_score DECIMAL(5,2) DEFAULT 0
```

### After Migration:
```sql
lv_editors_score DECIMAL(5,2)  -- ✅ Allows null
lv_crowdsource_score DECIMAL(5,2)
```

## Optional: Clean Up Existing Data

If you want to convert existing locations that have `0` scores to `null` (recommended), uncomment these lines in the migration file:

```sql
UPDATE public.locations SET lv_editors_score = NULL WHERE lv_editors_score = 0;
UPDATE public.locations SET lv_crowdsource_score = NULL WHERE lv_crowdsource_score = 0;
UPDATE public.locations SET google_rating = NULL WHERE google_rating = 0;
UPDATE public.locations SET michelin_score = NULL WHERE michelin_score = 0;
```

⚠️ **Warning:** This will change ALL locations with `0` scores to `null`. Only run this if you're sure `0` means "no rating" and not "rated as 0".

## For New Installations

If you're setting up a fresh database, use the updated schema files instead:
- `/SUPABASE_SETUP.md` (with sample data)
- `/SUPABASE_SETUP_PRODUCTION.md` (production-ready, no sample data)

These have been updated to NOT include `DEFAULT 0` constraints.

---

## Rollback (If Needed)

If you need to revert this migration:

```sql
ALTER TABLE public.locations 
  ALTER COLUMN lv_editors_score SET DEFAULT 0,
  ALTER COLUMN lv_crowdsource_score SET DEFAULT 0,
  ALTER COLUMN google_rating SET DEFAULT 0,
  ALTER COLUMN michelin_score SET DEFAULT 0;
```

---

**Questions?** Check the console logs when favoriting a location - you should no longer see `0` being inserted for ratings.
