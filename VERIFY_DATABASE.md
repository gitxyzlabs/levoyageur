# Database Verification Guide

Run these SQL queries in your Supabase SQL Editor to verify your database is set up correctly.

## 1. Check if all tables exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('locations', 'user_ratings', 'favorites');
```

**Expected result:** Should return 3 rows showing all three tables exist.

---

## 2. Verify `locations` table structure

```sql
SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'locations'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` - uuid
- `name` - text
- `lat` - double precision
- `lng` - double precision
- `description` - text
- `lv_editors_score` - numeric (5,2)
- `lv_crowdsource_score` - numeric (5,2)
- `google_rating` - numeric (3,2)
- `michelin_score` - integer
- `tags` - ARRAY
- `created_by` - uuid
- `created_at` - timestamp with time zone
- `updated_by` - uuid
- `updated_at` - timestamp with time zone

---

## 3. Verify `user_ratings` table structure

```sql
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'user_ratings'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` - uuid
- `user_id` - uuid
- `location_id` - uuid
- `rating` - numeric (4,1) ✅ **CRITICAL: Must be 4,1 not 3,0**
- `created_at` - timestamp with time zone
- `updated_at` - timestamp with time zone

---

## 4. Check rating constraint (MOST IMPORTANT!)

```sql
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'user_ratings'::regclass 
AND conname LIKE '%rating%';
```

**Expected result:** Should show constraint like:
```
CHECK ((rating >= 0.0) AND (rating <= 10.0))
```

---

## 5. Verify `favorites` table structure

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'favorites'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` - uuid
- `user_id` - uuid
- `location_id` - uuid
- `created_at` - timestamp with time zone

---

## 6. Check sample data exists

```sql
-- Count locations
SELECT COUNT(*) as total_locations FROM locations;

-- Show first 3 locations with scores
SELECT 
  name, 
  lv_editors_score, 
  lv_crowdsource_score, 
  google_rating,
  michelin_score,
  tags
FROM locations 
LIMIT 3;
```

**Expected result:** Should show at least 10 luxury San Diego venues if you loaded the sample data.

---

## 7. Verify indexes exist

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('locations', 'user_ratings', 'favorites')
ORDER BY tablename, indexname;
```

**Expected indexes:**
- `idx_locations_tags` on locations using GIN
- `idx_user_ratings_user_id` on user_ratings
- `idx_user_ratings_location_id` on user_ratings
- `idx_favorites_user_id` on favorites
- `idx_favorites_location_id` on favorites

---

## 8. Test a rating insert (will fail if constraint is wrong)

```sql
-- This should SUCCEED (rating = 8.5 is valid)
INSERT INTO user_ratings (user_id, location_id, rating)
VALUES (
  gen_random_uuid(), 
  (SELECT id FROM locations LIMIT 1), 
  8.5
);

-- Check if it was inserted
SELECT rating FROM user_ratings ORDER BY created_at DESC LIMIT 1;

-- Clean up test data
DELETE FROM user_ratings WHERE user_id NOT IN (SELECT id FROM auth.users);
```

**Expected:** Insert should work without errors.

---

## 9. Test rating constraint boundaries

```sql
-- These should all FAIL with constraint violation:
INSERT INTO user_ratings (user_id, location_id, rating) 
VALUES (gen_random_uuid(), (SELECT id FROM locations LIMIT 1), 10.1); -- Too high

INSERT INTO user_ratings (user_id, location_id, rating) 
VALUES (gen_random_uuid(), (SELECT id FROM locations LIMIT 1), -0.1); -- Too low

-- This should SUCCEED:
INSERT INTO user_ratings (user_id, location_id, rating) 
VALUES (gen_random_uuid(), (SELECT id FROM locations LIMIT 1), 10.0); -- Exactly 10

-- Clean up
DELETE FROM user_ratings WHERE user_id NOT IN (SELECT id FROM auth.users);
```

---

## 10. Check RLS (Row Level Security) policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('locations', 'user_ratings', 'favorites')
ORDER BY tablename, policyname;
```

**Expected policies:**
- `locations`: Enable read for authenticated
- `user_ratings`: Enable all for users on own ratings
- `favorites`: Enable all for users on own favorites

---

## Quick Health Check (Run this first!)

```sql
-- One-line health check
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('locations', 'user_ratings', 'favorites')) as tables_exist,
  (SELECT COUNT(*) FROM locations) as location_count,
  (SELECT COUNT(*) FROM user_ratings) as rating_count,
  (SELECT COUNT(*) FROM favorites) as favorite_count,
  (SELECT numeric_scale FROM information_schema.columns WHERE table_name = 'user_ratings' AND column_name = 'rating') as rating_decimal_places;
```

**Expected result:**
```
tables_exist: 3
location_count: 10+ (if sample data loaded)
rating_count: 0+ (depends on usage)
favorite_count: 0+ (depends on usage)
rating_decimal_places: 1 ✅ (CRITICAL - must be 1, not 0)
```

---

## 🚨 Common Issues & Fixes

### Issue 1: `rating_decimal_places` is 0 instead of 1
**Problem:** Old schema used `DECIMAL(3,0)` which stores whole numbers (0-100)
**Fix:** Run this migration:
```sql
ALTER TABLE user_ratings 
ALTER COLUMN rating TYPE DECIMAL(4,1);

ALTER TABLE user_ratings 
DROP CONSTRAINT IF EXISTS user_ratings_rating_check;

ALTER TABLE user_ratings 
ADD CONSTRAINT user_ratings_rating_check 
CHECK (rating >= 0 AND rating <= 10);
```

### Issue 2: Tables don't exist
**Fix:** Run the full SQL setup from `/SUPABASE_SETUP.md`

### Issue 3: RLS policies blocking queries
**Fix:** Ensure policies are set up correctly (see step 10)

---

## After Verification

Once all checks pass:
1. ✅ Your database is correctly configured
2. ✅ Rating system will work with 0.0-10.0 scale
3. ✅ Favorites and ratings will save properly
4. ✅ No more "failed to load" errors

If any checks fail, share the error message and I'll help you fix it! 🚀
