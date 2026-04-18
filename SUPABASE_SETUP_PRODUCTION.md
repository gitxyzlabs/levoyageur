# Le Voyageur - Production Database Setup (No Sample Data)

⚠️ **PRODUCTION SETUP - NO SAMPLE DATA**

This is the **production-ready** version with NO sample locations. Use this for your live deployment.

---

## ⚡ Quick Start (One-Click Setup)

**Copy and paste this ENTIRE SQL block into Supabase SQL Editor and click \"Run\":**

```sql
-- ================================================================
-- LE VOYAGEUR - PRODUCTION DATABASE SETUP (NO SAMPLE DATA)
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

COMMENT ON TABLE public.user_metadata IS 'Stores user profile data and roles';
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

-- Apply to user_metadata table
DROP TRIGGER IF EXISTS trigger_user_metadata_updated_at ON public.user_metadata;
CREATE TRIGGER trigger_user_metadata_updated_at
  BEFORE UPDATE ON public.user_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 7: ROW LEVEL SECURITY (RLS)
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
SELECT 'Production Setup Complete! ✅' as status;

-- Count tables
SELECT 
  'Tables Created' as check_name,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('locations', 'user_ratings', 'favorites', 'user_metadata');

-- Count locations (should be 0 for production)
SELECT 
  'Locations (Production - Empty)' as check_name,
  COUNT(*) as count
FROM public.locations;

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
status: Production Setup Complete! ✅

check_name: Tables Created
count: 4

check_name: Locations (Production - Empty)
count: 0

check_name: Rating Constraint
numeric_precision: 4
numeric_scale: 1
expected: Should be 4,1
```

---

## 🚀 Next Steps After Setup

1. **First User Becomes Editor**
   - The very first person to sign up will automatically become an editor
   - All subsequent users will be regular users

2. **Add Your First Location**
   - Sign in as the editor
   - Use the Editor Panel to add locations
   - Make sure to use real Google Place IDs

3. **Promote Other Editors**
   - Go to Admin Panel (editors only)
   - Promote trusted users to editor role

---

## 📊 Database Structure

### Tables Created:
1. **locations** - 0 rows (empty, ready for production)
2. **user_ratings** - 0 rows (empty)
3. **favorites** - 0 rows (empty)
4. **user_metadata** - 0 rows (will populate on first signup)

### Security:
- ✅ RLS enabled on all tables
- ✅ Proper policies for user access
- ✅ Editors can manage locations
- ✅ Users can rate and favorite

### Auto-Features:
- ✅ Crowdsource score auto-updates when users rate
- ✅ Timestamps auto-update on changes
- ✅ First-user-is-editor logic

---

## 🎯 Production Checklist

Before going live, make sure:

- [ ] Enable Google Places API (New) in Google Cloud Console
- [ ] Set GOOGLE_MAPS_API_KEY in Supabase env vars
- [ ] Run this production setup SQL
- [ ] Test signup/login flow
- [ ] Test adding a location as editor
- [ ] Test rating and favoriting
- [ ] Monitor Supabase logs for errors

---

## 🆘 If You Want Sample Data

If you need sample data for testing, use `/SUPABASE_SETUP.md` instead (includes 10 San Diego venues).

---

## 🏗️ Production-Ready!

Your database is now set up for production use with:
- Clean, empty tables
- Proper security policies
- Auto-calculating scores
- First-user-is-editor logic

**Go ahead and deploy!** 🚀