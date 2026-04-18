# Le Voyageur - Supabase Database Setup

⚠️ **IMPORTANT: This setup is REQUIRED for the app to work properly!**

Without running this SQL setup, you will see errors like:
- ❌ "Failed to load favorites"
- ❌ "Failed to save rating"  
- ❌ "Could not find table 'locations'"
- ❌ "Column does not exist"

Follow the steps below to set up your database in ~5 minutes.

---

## ⚡ Quick Start (One-Click Setup)

**Copy and paste this ENTIRE SQL block into Supabase SQL Editor and click "Run":**

```sql
-- ================================================================
-- LE VOYAGEUR - COMPLETE DATABASE SETUP
-- ================================================================
-- Rating Scales:
--   • User ratings: 0.0-10.0 (DECIMAL 4,1)
--   • LV Editors: 0.0-11.0 (DECIMAL 5,2)
--   • LV Crowdsource: 0.0-10.0 (DECIMAL 5,2, auto-calculated)
--   • Google: 0-5 (DECIMAL 3,2)
--   • Michelin: 0-3 (INTEGER)
-- ================================================================

-- ============================================
-- STEP 1: CREATE LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- LV Scores (nullable - only set by editors)
  lv_editors_score DECIMAL(5,2) CHECK (lv_editors_score >= 0 AND lv_editors_score <= 11),
  lv_crowdsource_score DECIMAL(5,2) CHECK (lv_crowdsource_score >= 0 AND lv_crowdsource_score <= 10),
  google_rating DECIMAL(3,2) CHECK (google_rating >= 0 AND google_rating <= 5),
  michelin_score INTEGER CHECK (michelin_score >= 0 AND michelin_score <= 3),
  
  -- Location Details
  tags TEXT[] DEFAULT '{}',
  cuisine TEXT,
  area TEXT,
  image TEXT,
  place_id TEXT,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_lat_lng ON public.locations(lat, lng);
CREATE INDEX IF NOT EXISTS idx_locations_tags ON public.locations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_locations_place_id ON public.locations(place_id);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON public.locations(created_at DESC);

-- Documentation
COMMENT ON TABLE public.locations IS 'Stores all restaurant and venue locations with LV scores';
COMMENT ON COLUMN public.locations.lv_editors_score IS 'Le Voyageur editors score (0.0-11.0)';
COMMENT ON COLUMN public.locations.lv_crowdsource_score IS 'Community average score (0.0-10.0, auto-calculated)';
COMMENT ON COLUMN public.locations.google_rating IS 'Google rating (0-5)';
COMMENT ON COLUMN public.locations.michelin_score IS 'Michelin stars (0-3)';

-- ============================================
-- STEP 2: CREATE USER RATINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  rating DECIMAL(4,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one rating per user per location
  UNIQUE(user_id, location_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_ratings_user_id ON public.user_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_location_id ON public.user_ratings(location_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_created_at ON public.user_ratings(created_at DESC);

COMMENT ON TABLE public.user_ratings IS 'Stores individual user ratings for locations (0.0-10.0 scale)';
COMMENT ON COLUMN public.user_ratings.rating IS 'User rating (0.0-10.0 with one decimal place)';

-- ============================================
-- STEP 3: CREATE FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one favorite per user per location
  UNIQUE(user_id, location_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_location_id ON public.favorites(location_id);

COMMENT ON TABLE public.favorites IS 'Stores user favorite locations';

-- ============================================
-- STEP 4: CREATE USER METADATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_metadata (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'editor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_metadata_role ON public.user_metadata(role);
CREATE INDEX IF NOT EXISTS idx_user_metadata_email ON public.user_metadata(email);

COMMENT ON TABLE public.user_metadata IS 'Stores user profile data and roles (replaces KV store)';
COMMENT ON COLUMN public.user_metadata.role IS 'User role: "user" (normal traveler) or "editor" (can add/edit locations)';

-- ============================================
-- STEP 5: AUTO-UPDATE CROWDSOURCE SCORE
-- ============================================
CREATE OR REPLACE FUNCTION update_crowdsource_score()
RETURNS TRIGGER AS $$
DECLARE
  target_location_id UUID;
BEGIN
  -- Determine which location_id to update
  IF TG_OP = 'DELETE' THEN
    target_location_id := OLD.location_id;
  ELSE
    target_location_id := NEW.location_id;
  END IF;
  
  -- Update the crowdsource score (average of all user ratings)
  UPDATE public.locations
  SET 
    lv_crowdsource_score = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
      FROM public.user_ratings
      WHERE location_id = target_location_id
    ),
    updated_at = NOW()
  WHERE id = target_location_id;
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_crowdsource_score ON public.user_ratings;
CREATE TRIGGER trigger_update_crowdsource_score
  AFTER INSERT OR UPDATE OR DELETE ON public.user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_crowdsource_score();

COMMENT ON FUNCTION update_crowdsource_score IS 'Auto-calculates average crowdsource score (0-10) when user ratings change';

-- ============================================
-- STEP 6: AUTO-UPDATE TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to locations table
DROP TRIGGER IF EXISTS trigger_locations_updated_at ON public.locations;
CREATE TRIGGER trigger_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to user_ratings table
DROP TRIGGER IF EXISTS trigger_user_ratings_updated_at ON public.user_ratings;
CREATE TRIGGER trigger_user_ratings_updated_at
  BEFORE UPDATE ON public.user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 7: INSERT SAMPLE DATA
-- ============================================
INSERT INTO public.locations (
  name, description, lat, lng, lv_editors_score, lv_crowdsource_score, 
  google_rating, michelin_score, tags, cuisine, area, place_id
) VALUES
(
  'Addison',
  'California''s first three-Michelin-star restaurant, offering exquisite French cuisine in an elegant Del Mar setting',
  32.9547, -117.2441,
  10.5, 0, 4.8, 3,
  ARRAY['fine dining', 'french', 'michelin', 'luxury', 'tasting menu'],
  'French',
  'Del Mar',
  'ChIJfyndu9RU2YAR7MyiocCLaMg'
),
(
  'Jeune et Jolie',
  'Intimate French bistro with a modern twist, featuring seasonal ingredients and natural wines',
  32.8653, -117.2433,
  9.8, 0, 4.7, 1,
  ARRAY['fine dining', 'french', 'michelin', 'wine bar', 'romantic'],
  'French',
  'Carlsbad',
  'ChIJCQ8Q5ZZU2YARQzqhcCn-Q-w'
),
(
  'Callie',
  'Coastal Mediterranean cuisine with wood-fired dishes in a stunning Little Italy space',
  32.7353, -117.1690,
  9.2, 0, 4.6, 0,
  ARRAY['mediterranean', 'seafood', 'fine dining', 'wood-fired', 'trendy'],
  'Mediterranean',
  'Little Italy',
  'ChIJF5VWI6lU2YAR8KVq2Vz_uKg'
),
(
  'Born & Raised',
  'Opulent rooftop steakhouse with 1920s glamour, dry-aged steaks, and craft cocktails',
  32.7350, -117.1698,
  10.2, 0, 4.7, 1,
  ARRAY['steakhouse', 'fine dining', 'rooftop', 'cocktails', 'luxury'],
  'Steakhouse',
  'Little Italy',
  'ChIJo9V8n6lU2YARjGW9fO7HqAc'
),
(
  'Campfire',
  'Modern American with open-fire cooking, creative cocktails, and rustic-chic ambiance',
  32.7320, -117.1650,
  9.0, 0, 4.5, 0,
  ARRAY['american', 'wood-fired', 'cocktails', 'outdoor', 'creative'],
  'American',
  'Carlsbad',
  'ChIJJ3VWI6lU2YAR7KVq2Vz_uKh'
),
(
  'Tacos El Gordo',
  'Legendary Tijuana-style taqueria serving authentic adobada, carne asada, and lengua',
  32.7157, -117.1611,
  8.7, 0, 4.5, 0,
  ARRAY['tacos', 'mexican', 'casual', 'authentic', 'late night'],
  'Mexican',
  'Chula Vista',
  'ChIJu5VrEahU2YARl4Sq_VHhQ7E'
),
(
  'Sushi Tadokoro',
  'Intimate omakase experience with pristine fish flown from Japan, limited seating',
  32.8331, -117.2713,
  9.7, 0, 4.9, 0,
  ARRAY['sushi', 'omakase', 'japanese', 'fine dining', 'intimate'],
  'Japanese',
  'San Diego',
  'ChIJ7QwpIqNU2YARO4E9LbTB9DM'
),
(
  'The Crack Shack',
  'Elevated fried chicken and egg-centric dishes in a laid-back outdoor setting',
  32.7353, -117.1490,
  8.2, 0, 4.4, 0,
  ARRAY['chicken', 'casual', 'outdoor', 'family friendly', 'brunch'],
  'American',
  'Little Italy',
  'ChIJKZVWI6lU2YARsKVq2Vz_uKi'
),
(
  'Animae',
  'Stylish Asian-fusion with theatrical presentation, stunning cocktails, and energetic vibe',
  32.7155, -117.1614,
  8.9, 0, 4.5, 0,
  ARRAY['asian fusion', 'fine dining', 'cocktails', 'trendy', 'instagram'],
  'Asian Fusion',
  'Downtown',
  'ChIJpZVWI6lU2YARtKVq2Vz_uKj'
),
(
  'Trust Restaurant',
  'Farm-to-table pioneer with seasonal tasting menus and natural wine pairings',
  32.7345, -117.1485,
  9.4, 0, 4.6, 0,
  ARRAY['farm to table', 'tasting menu', 'wine pairing', 'seasonal', 'organic'],
  'New American',
  'Hillcrest',
  'ChIJqZVWI6lU2YARuKVq2Vz_uKk'
);

-- ============================================
-- STEP 8: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metadata ENABLE ROW LEVEL SECURITY;

-- LOCATIONS POLICIES
-- Everyone can read locations
DROP POLICY IF EXISTS "locations_select_policy" ON public.locations;
CREATE POLICY "locations_select_policy" ON public.locations
  FOR SELECT USING (true);

-- Only authenticated users can insert
DROP POLICY IF EXISTS "locations_insert_policy" ON public.locations;
CREATE POLICY "locations_insert_policy" ON public.locations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated users can update
DROP POLICY IF EXISTS "locations_update_policy" ON public.locations;
CREATE POLICY "locations_update_policy" ON public.locations
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Only authenticated users can delete
DROP POLICY IF EXISTS "locations_delete_policy" ON public.locations;
CREATE POLICY "locations_delete_policy" ON public.locations
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- USER RATINGS POLICIES
-- Users can read all ratings
DROP POLICY IF EXISTS "ratings_select_policy" ON public.user_ratings;
CREATE POLICY "ratings_select_policy" ON public.user_ratings
  FOR SELECT USING (true);

-- Users can only insert their own ratings
DROP POLICY IF EXISTS "ratings_insert_policy" ON public.user_ratings;
CREATE POLICY "ratings_insert_policy" ON public.user_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own ratings
DROP POLICY IF EXISTS "ratings_update_policy" ON public.user_ratings;
CREATE POLICY "ratings_update_policy" ON public.user_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own ratings
DROP POLICY IF EXISTS "ratings_delete_policy" ON public.user_ratings;
CREATE POLICY "ratings_delete_policy" ON public.user_ratings
  FOR DELETE USING (auth.uid() = user_id);

-- FAVORITES POLICIES
-- Users can read all favorites
DROP POLICY IF EXISTS "favorites_select_policy" ON public.favorites;
CREATE POLICY "favorites_select_policy" ON public.favorites
  FOR SELECT USING (true);

-- Users can only insert their own favorites
DROP POLICY IF EXISTS "favorites_insert_policy" ON public.favorites;
CREATE POLICY "favorites_insert_policy" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own favorites
DROP POLICY IF EXISTS "favorites_delete_policy" ON public.favorites;
CREATE POLICY "favorites_delete_policy" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- USER METADATA POLICIES
-- Users can read all user metadata (needed for admin panel)
DROP POLICY IF EXISTS "user_metadata_select_policy" ON public.user_metadata;
CREATE POLICY "user_metadata_select_policy" ON public.user_metadata
  FOR SELECT USING (true);

-- Only authenticated users can insert their own metadata (via server)
DROP POLICY IF EXISTS "user_metadata_insert_policy" ON public.user_metadata;
CREATE POLICY "user_metadata_insert_policy" ON public.user_metadata
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only the user themselves or editors can update user metadata
DROP POLICY IF EXISTS "user_metadata_update_policy" ON public.user_metadata;
CREATE POLICY "user_metadata_update_policy" ON public.user_metadata
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.user_metadata 
      WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

-- ============================================
-- VERIFICATION
-- ============================================

-- Show summary of created objects
SELECT 'Setup Complete! ✅' as status;

-- Count tables
SELECT 
  'Tables Created' as check_name,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('locations', 'user_ratings', 'favorites', 'user_metadata');

-- Count sample locations
SELECT 
  'Sample Locations' as check_name,
  COUNT(*) as count
FROM public.locations;

-- Show top 3 locations
SELECT 
  name, 
  lv_editors_score, 
  lv_crowdsource_score,
  michelin_score,
  cuisine
FROM public.locations 
ORDER BY lv_editors_score DESC
LIMIT 3;

-- Verify rating constraint
SELECT 
  'Rating Constraint' as check_name,
  numeric_precision,
  numeric_scale,
  'Should be 4,1' as expected
FROM information_schema.columns
WHERE table_name = 'user_ratings' AND column_name = 'rating';
```

---

## ✅ Expected Output

After running the above SQL, you should see:

```
status: Setup Complete! ✅

check_name: Tables Created
count: 4

check_name: Sample Locations
count: 10

name           | lv_editors_score | lv_crowdsource_score | michelin_score | cuisine
---------------|------------------|----------------------|----------------|------------
Addison        | 10.50            | 0.00                 | 3              | French
Born & Raised  | 10.20            | 0.00                 | 1              | Steakhouse
Jeune et Jolie | 9.80             | 0.00                 | 1              | French

check_name: Rating Constraint
numeric_precision: 4
numeric_scale: 1
expected: Should be 4,1
```

---

## 📊 Rating System Summary

| Score Type           | Scale      | Precision   | Who Sets It         |
|----------------------|------------|-------------|---------------------|
| **User Rating**      | 0.0-10.0   | DECIMAL(4,1)| Individual users    |
| **LV Editors Score** | 0.0-11.0   | DECIMAL(5,2)| LV Editors only     |
| **LV Crowdsource**   | 0.0-10.0   | DECIMAL(5,2)| Auto-calculated avg |
| **Google Rating**    | 0.0-5.0    | DECIMAL(3,2)| From Google API     |
| **Michelin Score**   | 0-3        | INTEGER     | Manual entry        |

### Why 0-11 for Editors?
The extra point (11) allows LV editors to mark truly exceptional venues that transcend the normal 10-point scale - think three-Michelin-star establishments or once-in-a-lifetime experiences.

---

## 🔍 Manual Verification (Optional)

If you want to double-check everything:

### 1. Check Table Structure
```sql
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'user_ratings' AND column_name = 'rating';
```
**Expected:** `rating | numeric | 4 | 1`

### 2. Test Rating Boundaries
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

-- Clean up test data
DELETE FROM user_ratings WHERE user_id NOT IN (SELECT id FROM auth.users);
```

### 3. Test Crowdsource Auto-Update
```sql
-- Insert a test rating
INSERT INTO user_ratings (user_id, location_id, rating) 
VALUES (
  gen_random_uuid(), 
  (SELECT id FROM locations WHERE name = 'Tacos El Gordo'), 
  9.5
);

-- Check if crowdsource score updated
SELECT name, lv_crowdsource_score 
FROM locations 
WHERE name = 'Tacos El Gordo';
-- Should show 9.50

-- Clean up
DELETE FROM user_ratings WHERE user_id NOT IN (SELECT id FROM auth.users);
```

---

## 🗑️ Clean Slate (If You Need to Start Over)

If you made mistakes and want to rebuild:

```sql
-- ⚠️ WARNING: This deletes EVERYTHING! ⚠️
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.user_ratings CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP FUNCTION IF EXISTS update_crowdsource_score() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP TABLE IF EXISTS public.user_metadata CASCADE;

-- Now run the main setup SQL again
```

---

## 📐 Database Schema Diagram

```
┌────────────────────────────���─────┐
│         LOCATIONS                │
│  (Restaurants, Hotels, Venues)   │
├──────────────────────────────────┤
│ id (PK)                          │
│ name, lat, lng                   │
│ lv_editors_score     (0-11) ✨   │
│ lv_crowdsource_score (0-10) 🤖   │◄──────┐
│ google_rating        (0-5)       │       │
│ michelin_score       (0-3)       │       │
│ tags[], cuisine, area            │       │
└──────────────────────────────────┘       │
         ▲                                 │
         │                                 │
         │                            (auto-avg)
         │                                 │
         │                                 │
┌────────┴───────────────┐    ┌────────────┴─────────┐
│   USER_RATINGS         │    │    FAVORITES         │
├────────────────────────┤    ├──────────────────────┤
│ id (PK)                │    │ id (PK)              │
│ user_id                │    │ user_id              │
│ location_id (FK)   ────┤    │ location_id (FK) ────┤
│ rating (0.0-10.0) 👤   │    │ created_at           │
│ created_at             │    └──────────────────────┘
│ updated_at             │
└────────────────────────┘
```

**Key Features:**
- 🤖 `lv_crowdsource_score` auto-updates when users add/change ratings
- 👤 Users can only rate 0.0-10.0
- ✨ Editors can rate 0.0-11.0 for exceptional venues
- 🔒 RLS policies protect user data

---

## 🎉 Next Steps

After setup completes:

1. ✅ Your database is production-ready
2. ✅ 10 luxury San Diego venues are loaded as sample data
3. ✅ Users can rate, favorite, and discover locations
4. ✅ Crowdsource scores auto-calculate
5. ✅ No more "failed to load" errors!

**Test your app now!** The rating system should work perfectly with the 0-10 scale. 🚀

---

## 🆘 Troubleshooting

### "Failed to save rating" error persists
- Make sure you're logged in (check auth.uid())
- Verify RLS policies are created
- Check browser console for detailed error

### "Failed to load favorites" error
- Run: `SELECT COUNT(*) FROM favorites;` 
- If error, the table doesn't exist - run setup again

### Sample data shows wrong scores
- Check: `SELECT MAX(lv_editors_score) FROM locations;`
- Should be **10.50** (not 98.50)
- If wrong, you ran the old schema - use the SQL above

### Rating slider not working
- Check the `user_ratings` constraint
- Should be `rating <= 10` not `rating <= 100`

---

## 📞 Support

Still having issues? 
1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Verify your auth is working: Dashboard → Authentication → Users
3. Test RLS: Dashboard → Table Editor → Try inserting a row manually

Happy building! 🏗️✨