# Temporary Fix: Disable Count Queries

The "Bad Request" errors are happening because the `favorites` and `want_to_go` tables don't exist yet.

## Quick Fix (Temporary)
Comment out the count queries to stop the errors while still displaying locations.

## Permanent Fix
Run `/CREATE_MISSING_TABLES.sql` in your Supabase SQL editor to create the missing tables with proper RLS policies.

This will:
1. Create `favorites` table
2. Create `want_to_go` table  
3. Enable RLS with anonymous read access
4. Add indexes for performance
5. Allow the app to display favorite/bookmark counts
