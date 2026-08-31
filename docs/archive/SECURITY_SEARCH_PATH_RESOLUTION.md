# Security Fix: Function Search Path Vulnerability

## 🔴 Security Threat Identified

**Entity:** `public.trigger_update_location_score`

**Issue:** Function has a role mutable search_path

**Severity:** HIGH (especially if the function uses SECURITY DEFINER)

**Description:** Detects functions where the search_path parameter is not set, making them vulnerable to search_path injection attacks

## ⚠️ What This Means

When a function doesn't have an explicit `search_path` set:

### The Vulnerability
1. **Search Path Attack:** Malicious users can manipulate which schema PostgreSQL searches first
2. **Object Hijacking:** Attackers could create malicious tables/functions in schemas that appear earlier in the search_path
3. **Privilege Escalation:** If the function uses `SECURITY DEFINER`, it runs with elevated privileges, making this critical
4. **Data Manipulation:** Attackers could intercept or modify data by creating shadow objects

### Real-World Attack Example
```sql
-- Attacker creates a malicious table in a public schema
CREATE TABLE attacker_schema.locations (...);

-- When trigger_update_location_score runs without explicit search_path,
-- it might use attacker_schema.locations instead of public.locations
-- This could leak data or corrupt the database
```

## 🔍 What is search_path?

`search_path` determines which schemas PostgreSQL searches (and in what order) when resolving unqualified object names like `locations` instead of `public.locations`.

**Default search_path:** `"$user", public`

**Problem:** Users can change their search_path, and functions inherit this unless explicitly set.

## ✅ The Fix

Set an explicit, immutable `search_path` on the function:

```sql
CREATE OR REPLACE FUNCTION trigger_update_location_score()
...
SET search_path = public, pg_temp  -- ✅ SECURE
AS $$
...
$$;
```

### Why `public, pg_temp`?
- **`public`** - The schema where your tables live
- **`pg_temp`** - Allows temporary tables (safe, session-specific)
- **No `"$user"`** - Prevents user-controlled schema manipulation

## 📋 Action Required

Run the SQL script `/SECURITY_FIX_SEARCH_PATH.sql` in your Supabase SQL Editor.

The script will:
1. ✅ Identify all functions with mutable search_path
2. ✅ Show the current function definition
3. ✅ Drop and recreate `trigger_update_location_score` with secure search_path
4. ✅ Recreate the trigger on `user_ratings` table
5. ✅ Verify all functions are now secure
6. ✅ Provide a security summary

## 🔧 What the Function Does

`trigger_update_location_score` is a database trigger that:
- **Fires:** After INSERT/UPDATE/DELETE on `user_ratings` table
- **Purpose:** Automatically updates the `lv_score` field in the `locations` table
- **How:** Calculates the average rating from all user ratings for that location

This is a critical function for your app's rating system!

## 📊 Expected Results

After running the script:

```
✅ trigger_update_location_score has search_path = public, pg_temp
✅ Function is protected against search_path attacks
✅ Trigger still works correctly
✅ Supabase security warning will disappear
```

## 🎯 Why SECURITY DEFINER Functions Are Critical

If `trigger_update_location_score` uses `SECURITY DEFINER`:
- It runs with the privileges of the function **owner** (not the caller)
- This is necessary for triggers to update tables the user might not have direct access to
- **BUT** without a fixed search_path, it's a critical vulnerability
- An attacker could escalate privileges

## 🛡️ Best Practices for All Functions

When creating any function in the future:

```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER                    -- If needed
SET search_path = public, pg_temp   -- ✅ ALWAYS SET THIS
AS $$
BEGIN
  -- Use schema-qualified names for extra safety
  SELECT * FROM public.locations;   -- ✅ Good
  -- Not just: SELECT * FROM locations;  -- ⚠️ Less safe
END;
$$;
```

### Additional Security Tips
1. **Set search_path** on ALL functions
2. **Use schema-qualified names** (`public.table_name`) in function bodies
3. **Minimize SECURITY DEFINER** usage - only when necessary
4. **Review permissions** regularly

## 🔄 Impact Assessment

### Zero Impact on Functionality
- ✅ Function behavior remains exactly the same
- ✅ Trigger continues to work normally
- ✅ User ratings still update location scores
- ✅ No data changes needed

### Security Improvement
- 🛡️ Protected against search_path injection
- 🛡️ Cannot be hijacked by malicious schemas
- 🛡️ Privilege escalation prevented

## 📝 Post-Fix Verification

After running the script, verify:

1. **Check the function definition:**
   ```sql
   SELECT pg_get_functiondef(oid)
   FROM pg_proc
   WHERE proname = 'trigger_update_location_score';
   ```
   Should include `SET search_path = public, pg_temp`

2. **Test the rating system:**
   - Add a new rating to a location
   - Verify the location's `lv_score` updates correctly

3. **Check Supabase Security Advisor:**
   - The warning should disappear from your dashboard

## 🚨 Other Functions to Check

The audit script will identify if you have other vulnerable functions:
- Any other trigger functions
- Custom stored procedures
- Helper functions

**Common functions that need this fix:**
- Trigger functions (like this one)
- SECURITY DEFINER functions
- Functions that query/modify tables

## 🔍 How to Audit Manually

```sql
-- Find all functions without search_path set
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND NOT pg_get_functiondef(oid) LIKE '%SET search_path%';
```

## 📞 Next Steps

1. ✅ **Run `/SECURITY_FIX_SEARCH_PATH.sql`** in Supabase SQL Editor
2. ✅ **Test your rating system** to ensure it still works
3. ✅ **Verify the security warning** is gone from Supabase
4. ✅ **Fix any other functions** identified in the audit

## 🎯 Summary

**Threat:** Function vulnerable to search_path injection attacks  
**Risk:** HIGH (potential privilege escalation)  
**Solution:** Set explicit `search_path = public, pg_temp`  
**Time to Fix:** 60 seconds  
**Impact:** Zero functional impact, massive security improvement  

**Status After Fix:** 🟢 FUNCTION SECURED AGAINST SEARCH_PATH ATTACKS

---

## 📚 Additional Resources

- [PostgreSQL search_path Security](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [SECURITY DEFINER Best Practices](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/security)
