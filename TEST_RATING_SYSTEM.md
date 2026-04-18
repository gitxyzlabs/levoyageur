# 🧪 Rating System Test Guide

Use this guide to test that your rating system is working correctly with the new 0-10 scale.

---

## ✅ Quick Visual Test

### 1. **Check Sample Data Loaded Correctly**

Open the app and look at the map. Click on **Addison** (should be in Del Mar area).

**Expected InfoWindow Scores:**
```
✨ Le Voyageur:    10.5  ← Should be 10.5, NOT 98.5!
👥 LV Community:   0.0   ← No user ratings yet
⭐ Michelin Score: 3     ← Integer, no decimal
🌟 Google Rating:  4.8   ← From Google API
```

If you see **98.5** or **91.8**, your database still has old data. Drop tables and rerun setup.

---

### 2. **Test User Rating (0-10 Scale)**

**While logged in:**
1. Click on any location
2. Find the "My Rating" section (gray box)
3. Try the slider - drag it around
4. Click quick-select buttons: **5**, **7**, **8.5**, **9.5**

**Expected Behavior:**
- ✅ Slider moves smoothly from 0.0 to 10.0
- ✅ Big number shows one decimal: `8.5` not `85` or `8`
- ✅ Label updates: "Excellent", "Outstanding", etc.
- ✅ Toast shows: "Rated 8.5/10!" ← Check the "/10" part!
- ✅ LV Community score updates to match your rating
- ✅ Number like "(1)" appears next to community score

**Test Edge Cases:**
```
Slide to far left:  Should show 0.0
Slide to far right: Should show 10.0 (NOT 100!)
Click 9.5 button:   Should show 9.5/10
```

---

### 3. **Test Editor Rating (0-11 Scale)**

**Only works if you're an editor (first user is auto-promoted):**

1. Open sidebar
2. Click "Editor Tools"
3. Click "Add New Location"
4. Look at "LV Editors Score" field

**Expected:**
```
Label:       "LV Editors Score (0-11)"  ← Should say 0-11!
Min:         0
Max:         11  ← Not 10!
Step:        0.1
Placeholder: "9.8"
```

**Test:**
1. Type `10.8` → Should accept it ✅
2. Type `11.0` → Should accept it ✅
3. Type `11.1` → Should be prevented by max ❌

---

### 4. **Test Database Constraints**

**In Supabase SQL Editor, run:**

```sql
-- This should WORK (10.0 is max for users)
INSERT INTO user_ratings (user_id, location_id, rating) 
VALUES (
  gen_random_uuid(), 
  (SELECT id FROM locations LIMIT 1), 
  10.0
);

-- This should FAIL (10.1 exceeds max)
INSERT INTO user_ratings (user_id, location_id, rating) 
VALUES (
  gen_random_uuid(), 
  (SELECT id FROM locations LIMIT 1), 
  10.1
);
-- Expected error: "new row violates check constraint"

-- Clean up
DELETE FROM user_ratings WHERE user_id NOT IN (SELECT id FROM auth.users);
```

**Expected:**
- ✅ First insert succeeds
- ❌ Second insert fails with constraint error
- ✅ Cleanup works

---

## 🎯 Score Display Test

Click through each location and verify the scores look correct:

| Location       | Expected LV Editors | Display Should Show |
|----------------|---------------------|---------------------|
| Addison        | 10.50               | "10.5" ✅           |
| Born & Raised  | 10.20               | "10.2" ✅           |
| Jeune et Jolie | 9.80                | "9.8" ✅            |
| Sushi Tadokoro | 9.70                | "9.7" ✅            |
| Callie         | 9.20                | "9.2" ✅            |
| Campfire       | 9.00                | "9.0" ✅            |

**Red Flags 🚩:**
- If you see `98.5` or `91.8` → Old data, drop tables and rerun setup
- If you see `10` without decimal → Check .toFixed(1) is applied
- If you see `10.50` (two decimals) → This is okay, it's consistent

---

## 🔄 Crowdsource Auto-Update Test

**Test that crowdsource score auto-calculates:**

1. Find "Tacos El Gordo" on the map
2. Click it → LV Community should show **0.0 (0)**
3. While logged in, rate it **9.5**
4. Refresh the page
5. Click "Tacos El Gordo" again
6. LV Community should now show **9.5 (1)**

**Test with multiple ratings:**

In Supabase SQL Editor:
```sql
-- Add multiple test ratings
INSERT INTO user_ratings (user_id, location_id, rating) VALUES
  (gen_random_uuid(), (SELECT id FROM locations WHERE name = 'Tacos El Gordo'), 9.5),
  (gen_random_uuid(), (SELECT id FROM locations WHERE name = 'Tacos El Gordo'), 8.0),
  (gen_random_uuid(), (SELECT id FROM locations WHERE name = 'Tacos El Gordo'), 9.0);

-- Check if crowdsource updated
SELECT name, lv_crowdsource_score 
FROM locations 
WHERE name = 'Tacos El Gordo';
-- Should show: 8.83 (average of 9.5, 8.0, 9.0)

-- Clean up
DELETE FROM user_ratings WHERE location_id = (SELECT id FROM locations WHERE name = 'Tacos El Gordo');
```

---

## 🎨 UI/UX Test

### Compact Slider (InfoWindow)
**Expected appearance:**
- Height: 8 (h-8) - small enough for modal
- Text size: 2xl (smaller than editor panel)
- Background: Gray-50 (neutral, not colorful)
- Quick buttons: 4 buttons in a row
- Number display: "8.5" with "/10" label

### Full Slider (Not used currently, but for future editor features)
**Expected appearance:**
- Height: 12 (h-12) - bigger, more interactive
- Text size: 4xl (large, prominent)
- Background: Gradient gray with inner shadow
- Tick marks: Visible at 0, 2.5, 5, 7.5, 10
- Thumb: Large circle with glow effect

---

## 🐛 Common Test Failures

### Test Fails: "Rating shows 98.5"
**Diagnosis:** Old database schema  
**Fix:** Drop tables, rerun SUPABASE_SETUP.md

### Test Fails: "Can't save rating"
**Diagnosis:** Tables don't exist or RLS blocking  
**Fix:** 
1. Check tables exist: `SELECT COUNT(*) FROM user_ratings;`
2. Check you're logged in: Look for user email in sidebar
3. Check RLS policies exist (see VERIFY_DATABASE.md)

### Test Fails: "Crowdsource doesn't update"
**Diagnosis:** Trigger not created  
**Fix:** Rerun the trigger creation SQL from SUPABASE_SETUP.md

### Test Fails: "Can rate above 10"
**Diagnosis:** Constraint not set  
**Fix:** 
```sql
ALTER TABLE user_ratings 
DROP CONSTRAINT IF EXISTS user_ratings_rating_check;

ALTER TABLE user_ratings 
ADD CONSTRAINT user_ratings_rating_check 
CHECK (rating >= 0 AND rating <= 10);
```

---

## 📊 Console Log Test

Open browser console (F12) and watch for:

**When clicking a location:**
```
✅ Fetching place details for: [Location Name] place_id: [ID]
✅ Received place details: {...}
✅ Loaded N photos
```

**When rating:**
```
✅ Saving rating: 8.5 for location: [UUID]
✅ (No errors should appear)
```

**When saving favorite:**
```
✅ Added to favorites
```

**Red Flags in Console 🚩:**
```
❌ Failed to load favorites
❌ Failed to save rating
❌ Could not find table 'user_ratings'
❌ Column does not exist
```
If you see these, run SUPABASE_SETUP.md!

---

## 🎯 Final Validation

Run this comprehensive check:

```sql
-- 1. Tables exist
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name IN ('locations', 'user_ratings', 'favorites');
-- Expected: 3

-- 2. Rating precision is correct
SELECT numeric_precision, numeric_scale 
FROM information_schema.columns 
WHERE table_name = 'user_ratings' AND column_name = 'rating';
-- Expected: 4, 1 (not 5, 2!)

-- 3. Constraint is correct
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'user_ratings'::regclass 
AND conname LIKE '%rating_check%';
-- Expected: CHECK ((rating >= 0) AND (rating <= 10))

-- 4. Sample data is correct
SELECT name, lv_editors_score, lv_crowdsource_score 
FROM locations 
ORDER BY lv_editors_score DESC 
LIMIT 3;
-- Expected: Addison 10.50, Born & Raised 10.20, Jeune et Jolie 9.80
-- NOT: 98.50, 91.80, etc!

-- 5. Trigger exists
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'user_ratings'::regclass;
-- Expected: trigger_update_crowdsource_score
```

**All checks pass?** 🎉 **Your rating system is perfect!**

---

## 📸 Visual Checklist

Take screenshots of:
- [ ] Addison showing LV score of **10.5** (not 98.5)
- [ ] Your user rating slider from 0-10
- [ ] LV Community score updating after you rate
- [ ] Editor panel showing max="11"
- [ ] Console with no errors
- [ ] SQL query showing rating constraint CHECK <= 10

---

## 🚀 When All Tests Pass

You're ready to:
1. ✅ Commit and push to GitHub
2. ✅ Deploy to production
3. ✅ Start adding real locations
4. ✅ Invite beta testers
5. ✅ Launch Le Voyageur! 🎉

Happy testing! 🧪✨
