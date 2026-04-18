-- ====================================
-- Le Voyageur MINIMAL Performance Fix
-- ====================================
-- Only the essential stuff to fix errors and speed up queries

-- ====================================
-- STEP 1: Create want_to_go table
-- ====================================

CREATE TABLE IF NOT EXISTS want_to_go (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================
-- STEP 2: Clean Up Orphaned Data
-- ====================================

-- Remove favorites for users that don't exist
DELETE FROM favorites
WHERE NOT EXISTS (
  SELECT 1 FROM user_metadata WHERE user_metadata.user_id = favorites.user_id
);

-- Remove want_to_go for users that don't exist (if table has data)
DELETE FROM want_to_go
WHERE NOT EXISTS (
  SELECT 1 FROM user_metadata WHERE user_metadata.user_id = want_to_go.user_id
);

-- Remove user_ratings for users that don't exist (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ratings') THEN
    DELETE FROM user_ratings
    WHERE NOT EXISTS (
      SELECT 1 FROM user_metadata WHERE user_metadata.user_id = user_ratings.user_id
    );
  END IF;
END $$;

-- ====================================
-- STEP 3: CRITICAL Performance Indexes
-- ====================================
-- These fix your slow queries!

-- Locations table - ESSENTIAL for map queries
CREATE INDEX IF NOT EXISTS idx_locations_lat ON locations(lat);
CREATE INDEX IF NOT EXISTS idx_locations_lng ON locations(lng);
CREATE INDEX IF NOT EXISTS idx_locations_lat_lng ON locations(lat, lng);

-- Locations table - conditionally create indexes if columns exist
DO $$
BEGIN
  -- google_place_id index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'google_place_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_locations_google_place_id ON locations(google_place_id);
  END IF;

  -- michelin_id index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'michelin_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_locations_michelin_id ON locations(michelin_id);
  END IF;

  -- tags index (GIN for array searches)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'tags'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_locations_tags ON locations USING GIN(tags);
  END IF;

  -- created_by index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'created_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_locations_created_by ON locations(created_by);
  END IF;
END $$;

-- Favorites table indexes - ESSENTIAL for counting
CREATE INDEX IF NOT EXISTS idx_favorites_location_id ON favorites(location_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- Want_to_go table indexes - ESSENTIAL for counting
CREATE INDEX IF NOT EXISTS idx_want_to_go_location_id ON want_to_go(location_id);
CREATE INDEX IF NOT EXISTS idx_want_to_go_user_id ON want_to_go(user_id);

-- User_ratings indexes (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ratings') THEN
    CREATE INDEX IF NOT EXISTS idx_user_ratings_location_id ON user_ratings(location_id);
    CREATE INDEX IF NOT EXISTS idx_user_ratings_user_id ON user_ratings(user_id);
  END IF;
END $$;

-- ====================================
-- STEP 4: Add Unique Constraints
-- ====================================
-- Prevents duplicate favorites/want_to_go

ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_location_unique;
ALTER TABLE favorites ADD CONSTRAINT favorites_user_location_unique UNIQUE(user_id, location_id);

ALTER TABLE want_to_go DROP CONSTRAINT IF EXISTS want_to_go_user_location_unique;
ALTER TABLE want_to_go ADD CONSTRAINT want_to_go_user_location_unique UNIQUE(user_id, location_id);

-- ====================================
-- DONE!
-- ====================================

SELECT '✅ Minimal fix completed!' AS status;
SELECT '🚀 Performance indexes added' AS performance;
SELECT '✅ Errors should be gone now' AS result;
