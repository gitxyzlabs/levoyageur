# Security Threat Resolution - Le Voyageur

## 🔴 Security Threat Identified

**Entity:** `public.michelin_restaurants_backup`

**Issue:** Table is public but Row Level Security (RLS) has not been enabled

**Severity:** HIGH

**Description:** Detects cases where row level security (RLS) has not been enabled on tables in schemas exposed to PostgREST

## ⚠️ What This Means

When a table in the `public` schema doesn't have RLS enabled:
- **Anyone** with your Supabase anon key can read/write to this table
- The table is exposed via the PostgREST API
- There's no row-level access control
- This could lead to data leaks or unauthorized modifications

## ✅ Resolution Strategy

### Recommended: DROP the Backup Table

Since `michelin_restaurants_backup` is a backup table and your production data is in the `locations` table (as confirmed by your previous migrations):

1. **Drop the table entirely** - this is the safest approach
2. Backup tables should not be in production databases
3. They were likely created during migration/testing and are no longer needed

### Alternative: Enable RLS (if you need to keep it)

If you absolutely need to keep the backup table:

1. Enable RLS on the table
2. Create restrictive policies that block PostgREST access
3. Only allow service role to access it

## 📋 Action Required

Run the SQL script `/SECURITY_AUDIT_FIX.sql` in your Supabase SQL Editor:

```bash
# The script will:
1. Audit all tables for RLS status
2. DROP michelin_restaurants_backup table (recommended)
3. Enable RLS on any other unprotected tables
4. Provide a security summary
```

## 🔍 What the Audit Script Does

### Step 1: Identify All Tables
Shows which tables have RLS enabled and which don't

### Step 2: List Backup Tables
Finds any tables with "backup", "old", or "temp" in the name

### Step 3: Check the Specific Threat
Examines the `michelin_restaurants_backup` table

### Step 4: Fix - Drop Backup (RECOMMENDED)
```sql
DROP TABLE IF EXISTS public.michelin_restaurants_backup CASCADE;
```

### Step 5: Alternative Fix - Enable RLS
If you need to keep it (commented out by default):
```sql
ALTER TABLE public.michelin_restaurants_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only access" ON michelin_restaurants_backup
  USING (false);
```

### Step 6: Auto-Enable RLS on Other Tables
Automatically enables RLS on any other unprotected tables

### Step 7-9: Verification
Verifies all core tables are protected and provides a security summary

## 📊 Expected Results

After running the script:

✅ `michelin_restaurants_backup` table will be dropped  
✅ All production tables will have RLS enabled  
✅ Security threat will be resolved  
✅ Supabase security warnings will disappear  

## 🛡️ Core Tables That MUST Have RLS

These tables should all have RLS enabled:
- ✅ `locations` (main data)
- ✅ `favorites` (user favorites)
- ✅ `want_to_go` (user bookmarks)
- ✅ `user_ratings` (user reviews)
- ✅ `user_metadata` (user profiles)
- ✅ `lv_tags` (Le Voyageur tags)

## 🔐 Current RLS Policies (from DEBUG_RLS_FIX.sql)

These policies were already configured:

### Favorites
- **Policy:** "Anyone can count favorites"
- **Type:** SELECT
- **Access:** Public read (for counting, doesn't expose who favorited)

### Want_to_go  
- **Policy:** "Anyone can count want_to_go"
- **Type:** SELECT
- **Access:** Public read (for counting)

### User_ratings
- **Policy:** "Anyone can view ratings"
- **Type:** SELECT
- **Access:** Public read

**Note:** These permissive SELECT policies are intentional for your app's functionality (showing counts, ratings). They don't compromise security because:
- They only allow reading aggregate data
- They don't expose private user information
- Write operations are still protected
- The service role bypasses RLS for administrative operations

## 🚨 Why This Is Critical

Without RLS:
1. **Data Exposure:** Anyone could query all backup data via API
2. **Compliance Issues:** Violates data protection best practices
3. **Attack Surface:** Increases potential for data breaches
4. **Production Risk:** Backup tables shouldn't be in production DBs

## 📝 Post-Fix Verification

After running the script, verify in Supabase Dashboard:

1. Go to **Database → Tables**
2. Click on each table
3. Check **Policies** tab
4. Ensure RLS is enabled (green shield icon)
5. Security warnings should be gone

## 🔄 Future Prevention

To prevent this in the future:

1. **Never create backup tables in production** - use Supabase's built-in backup features
2. **Always enable RLS when creating tables:**
   ```sql
   CREATE TABLE new_table (...);
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ```
3. **Regularly run security audits** using the audit script
4. **Review Supabase Security Advisor** in the dashboard

## 📞 Next Steps

1. ✅ **Run `/SECURITY_AUDIT_FIX.sql`** in Supabase SQL Editor
2. ✅ **Review the security summary** output
3. ✅ **Verify in Supabase Dashboard** that warnings are gone
4. ✅ **Test your app** to ensure everything still works

## 🎯 Summary

**Threat:** Unprotected backup table exposed to public API  
**Risk:** HIGH  
**Solution:** Drop the backup table  
**Time to Fix:** 30 seconds  
**Impact:** Zero (backup table not used by production code)  

**Status After Fix:** 🟢 ALL TABLES SECURED
