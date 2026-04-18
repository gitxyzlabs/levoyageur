-- ====================================
-- Le Voyageur Database Migration
-- ====================================
-- Run this in Supabase SQL Editor to fix the entire schema

-- 1. Create want_to_go table (mirrors favorites structure)
CREATE TABLE IF NOT EXISTS want_to_go (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add missing foreign key constraints
-- (These will fail if they already exist - that's okay, ignore the errors)

-- Foreign keys for favorites table
ALTER TABLE favorites 
  DROP CONSTRAINT IF EXISTS favorites_user_id_fkey;
  
ALTER TABLE favorites 
  ADD CONSTRAINT favorites_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_metadata(user_id) 
  ON DELETE CASCADE;

ALTER TABLE favorites 
  DROP CONSTRAINT IF EXISTS favorites_location_id_fkey;
  
ALTER TABLE favorites 
  ADD CONSTRAINT favorites_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES locations(id) 
  ON DELETE CASCADE;

-- Foreign keys for want_to_go table
ALTER TABLE want_to_go 
  DROP CONSTRAINT IF EXISTS want_to_go_user_id_fkey;
  
ALTER TABLE want_to_go 
  ADD CONSTRAINT want_to_go_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_metadata(user_id) 
  ON DELETE CASCADE;

ALTER TABLE want_to_go 
  DROP CONSTRAINT IF EXISTS want_to_go_location_id_fkey;
  
ALTER TABLE want_to_go 
  ADD CONSTRAINT want_to_go_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES locations(id) 
  ON DELETE CASCADE;

-- Foreign keys for user_ratings table
ALTER TABLE user_ratings 
  DROP CONSTRAINT IF EXISTS user_ratings_user_id_fkey;
  
ALTER TABLE user_ratings 
  ADD CONSTRAINT user_ratings_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_metadata(user_id) 
  ON DELETE CASCADE;

ALTER TABLE user_ratings 
  DROP CONSTRAINT IF EXISTS user_ratings_location_id_fkey;
  
ALTER TABLE user_ratings 
  ADD CONSTRAINT user_ratings_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES locations(id) 
  ON DELETE CASCADE;

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_location_id ON favorites(location_id);

CREATE INDEX IF NOT EXISTS idx_want_to_go_user_id ON want_to_go(user_id);
CREATE INDEX IF NOT EXISTS idx_want_to_go_location_id ON want_to_go(location_id);

CREATE INDEX IF NOT EXISTS idx_user_ratings_user_id ON user_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_location_id ON user_ratings(location_id);

CREATE INDEX IF NOT EXISTS idx_locations_place_id ON locations(place_id);
CREATE INDEX IF NOT EXISTS idx_locations_created_by ON locations(created_by);

-- 4. Add unique constraints to prevent duplicate favorites/want_to_go
ALTER TABLE favorites 
  DROP CONSTRAINT IF EXISTS favorites_user_location_unique;
  
ALTER TABLE favorites 
  ADD CONSTRAINT favorites_user_location_unique 
  UNIQUE(user_id, location_id);

ALTER TABLE want_to_go 
  DROP CONSTRAINT IF EXISTS want_to_go_user_location_unique;
  
ALTER TABLE want_to_go 
  ADD CONSTRAINT want_to_go_user_location_unique 
  UNIQUE(user_id, location_id);

ALTER TABLE user_ratings 
  DROP CONSTRAINT IF EXISTS user_ratings_user_location_unique;
  
ALTER TABLE user_ratings 
  ADD CONSTRAINT user_ratings_user_location_unique 
  UNIQUE(user_id, location_id);

-- 5. Enable Row Level Security (RLS) - IMPORTANT for security!
ALTER TABLE user_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE want_to_go ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies

-- user_metadata: users can read their own data
DROP POLICY IF EXISTS "Users can view own metadata" ON user_metadata;
CREATE POLICY "Users can view own metadata" ON user_metadata
  FOR SELECT USING (auth.uid() = user_id);

-- locations: everyone can read, only editors can create/update
DROP POLICY IF EXISTS "Anyone can view locations" ON locations;
CREATE POLICY "Anyone can view locations" ON locations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Editors can insert locations" ON locations;
CREATE POLICY "Editors can insert locations" ON locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_metadata 
      WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

DROP POLICY IF EXISTS "Editors can update locations" ON locations;
CREATE POLICY "Editors can update locations" ON locations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_metadata 
      WHERE user_id = auth.uid() AND role = 'editor'
    )
  );

-- favorites: users can manage their own favorites
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON favorites;
CREATE POLICY "Users can insert own favorites" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;
CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- want_to_go: users can manage their own want_to_go
DROP POLICY IF EXISTS "Users can view own want_to_go" ON want_to_go;
CREATE POLICY "Users can view own want_to_go" ON want_to_go
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own want_to_go" ON want_to_go;
CREATE POLICY "Users can insert own want_to_go" ON want_to_go
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own want_to_go" ON want_to_go;
CREATE POLICY "Users can delete own want_to_go" ON want_to_go
  FOR DELETE USING (auth.uid() = user_id);

-- user_ratings: users can manage their own ratings
DROP POLICY IF EXISTS "Users can view own ratings" ON user_ratings;
CREATE POLICY "Users can view own ratings" ON user_ratings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ratings" ON user_ratings;
CREATE POLICY "Users can insert own ratings" ON user_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ratings" ON user_ratings;
CREATE POLICY "Users can update own ratings" ON user_ratings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ratings" ON user_ratings;
CREATE POLICY "Users can delete own ratings" ON user_ratings
  FOR DELETE USING (auth.uid() = user_id);

-- Done!
SELECT 'Migration completed successfully! ✅' AS status;
