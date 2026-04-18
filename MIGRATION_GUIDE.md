# Database Migration Guide: Unified Locations Table

## Overview
This migration consolidates the separate `locations` and `michelin_restaurants` tables into a single unified `locations` table, creating a single source of truth for all venue data.

## Migration Steps

### Step 1: Run this SQL in your Supabase SQL Editor

```sql
-- ==================================================
-- PART 1: Create new unified locations table
-- ==================================================

-- Drop existing locations table (backup data first if you have important data!)
-- WARNING: This will delete all existing location data. 
-- If you have important data, export it first!
DROP TABLE IF EXISTS user_ratings CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS want_to_go CASCADE;

-- Create the unified locations table
CREATE TABLE locations (
  -- Internal identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id TEXT UNIQUE, -- Google's Place ID
  michelin_id TEXT UNIQUE, -- Original Michelin restaurant ID from michelin_restaurants
  
  -- Core location data
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT, -- 'restaurant', 'hotel', 'bar', etc.
  tags TEXT[] DEFAULT '{}', -- For heat map searches
  
  -- External ratings (from 3rd party sources)
  google_rating DOUBLE PRECISION, -- 0-5 scale
  google_ratings_count INTEGER,
  michelin_stars INTEGER, -- 1, 2, or 3
  michelin_distinction TEXT, -- 'Bib Gourmand', 'Green Star', etc.
  michelin_green_star BOOLEAN DEFAULT false,
  michelin_price TEXT, -- Price range from Michelin
  michelin_cuisine TEXT, -- Cuisine type from Michelin
  michelin_description TEXT, -- Description from Michelin Guide
  michelin_url TEXT, -- Michelin Guide URL
  michelin_website_url TEXT, -- Restaurant's website
  michelin_phone_number TEXT,
  michelin_facilities TEXT, -- Facilities and services
  
  -- Le Voyageur ratings (your system)
  lv_editor_score DOUBLE PRECISION, -- 0.0 - 11.0 scale
  lv_editor_notes TEXT, -- Editor's notes
  lv_avg_user_score DOUBLE PRECISION, -- 0.0 - 10.0 scale (cached)
  lv_user_ratings_count INTEGER DEFAULT 0,
  
  -- Additional metadata
  cuisine TEXT, -- General cuisine type
  area TEXT, -- Neighborhood/area name
  image TEXT, -- Image URL
  description TEXT, -- General description
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID,
  updated_by_user_id UUID
);

-- Create indexes for performance
CREATE INDEX idx_locations_google_place_id ON locations(google_place_id);
CREATE INDEX idx_locations_michelin_id ON locations(michelin_id);
CREATE INDEX idx_locations_lat_lng ON locations(lat, lng);
CREATE INDEX idx_locations_tags ON locations USING GIN(tags);
CREATE INDEX idx_locations_category ON locations(category);
CREATE INDEX idx_locations_city ON locations(city);

-- ==================================================
-- PART 2: Migrate Michelin data into locations
-- ==================================================

-- Insert all Michelin restaurants into the unified locations table
INSERT INTO locations (
  michelin_id,
  name,
  address,
  city,
  lat,
  lng,
  category,
  michelin_stars,
  michelin_distinction,
  michelin_green_star,
  michelin_price,
  michelin_cuisine,
  michelin_description,
  michelin_url,
  michelin_website_url,
  michelin_phone_number,
  michelin_facilities,
  tags,
  cuisine,
  created_at,
  updated_at
)
SELECT 
  id::TEXT as michelin_id,
  "Name" as name,
  "Address" as address,
  "Location" as city,
  "Latitude" as lat,
  "Longitude" as lng,
  'restaurant' as category,
  CASE 
    WHEN "Award" ILIKE '%3 star%' THEN 3
    WHEN "Award" ILIKE '%2 star%' THEN 2
    WHEN "Award" ILIKE '%1 star%' THEN 1
    ELSE NULL
  END as michelin_stars,
  CASE 
    WHEN "Award" ILIKE '%bib gourmand%' THEN 'Bib Gourmand'
    ELSE NULL
  END as michelin_distinction,
  COALESCE("GreenStar", 0) = 1 as michelin_green_star,
  "Price" as michelin_price,
  "Cuisine" as michelin_cuisine,
  "Description" as michelin_description,
  "Url" as michelin_url,
  "WebsiteUrl" as michelin_website_url,
  "PhoneNumber" as michelin_phone_number,
  "FacilitiesAndServices" as michelin_facilities,
  ARRAY['restaurant']::TEXT[] as tags, -- Add basic tags
  "Cuisine" as cuisine,
  NOW() as created_at,
  NOW() as updated_at
FROM michelin_restaurants
WHERE "Latitude" IS NOT NULL 
  AND "Longitude" IS NOT NULL;

-- ==================================================
-- PART 3: Create user_ratings table
-- ==================================================

CREATE TABLE user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score DOUBLE PRECISION NOT NULL CHECK (score >= 0 AND score <= 10),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, user_id) -- One rating per user per location
);

CREATE INDEX idx_user_ratings_location_id ON user_ratings(location_id);
CREATE INDEX idx_user_ratings_user_id ON user_ratings(user_id);

-- ==================================================
-- PART 4: Recreate favorites and want_to_go tables
-- ==================================================

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_location_id ON favorites(location_id);

CREATE TABLE want_to_go (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

CREATE INDEX idx_want_to_go_user_id ON want_to_go(user_id);
CREATE INDEX idx_want_to_go_location_id ON want_to_go(location_id);

-- ==================================================
-- PART 5: Create helper function to update cached user scores
-- ==================================================

-- Function to recalculate average user score for a location
CREATE OR REPLACE FUNCTION update_location_user_score(loc_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE locations
  SET 
    lv_avg_user_score = (
      SELECT AVG(score)
      FROM user_ratings
      WHERE location_id = loc_id
    ),
    lv_user_ratings_count = (
      SELECT COUNT(*)
      FROM user_ratings
      WHERE location_id = loc_id
    ),
    updated_at = NOW()
  WHERE id = loc_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update cached score when user rating changes
CREATE OR REPLACE FUNCTION trigger_update_location_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_location_user_score(OLD.location_id);
    RETURN OLD;
  ELSE
    PERFORM update_location_user_score(NEW.location_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_ratings_update_location_score
AFTER INSERT OR UPDATE OR DELETE ON user_ratings
FOR EACH ROW
EXECUTE FUNCTION trigger_update_location_score();

-- ==================================================
-- PART 6: Row Level Security (RLS) Policies
-- ==================================================

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE want_to_go ENABLE ROW LEVEL SECURITY;

-- Locations: Public read, editors can write
CREATE POLICY "Locations are viewable by everyone" 
  ON locations FOR SELECT 
  USING (true);

CREATE POLICY "Editors can insert locations" 
  ON locations FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_metadata 
      WHERE user_id = auth.uid() 
      AND role = 'editor'
    )
  );

CREATE POLICY "Editors can update locations" 
  ON locations FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_metadata 
      WHERE user_id = auth.uid() 
      AND role = 'editor'
    )
  );

-- User ratings: Users can manage their own ratings
CREATE POLICY "Users can view all ratings" 
  ON user_ratings FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own ratings" 
  ON user_ratings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" 
  ON user_ratings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" 
  ON user_ratings FOR DELETE 
  USING (auth.uid() = user_id);

-- Favorites: Users can manage their own favorites
CREATE POLICY "Users can view their own favorites" 
  ON favorites FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" 
  ON favorites FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" 
  ON favorites FOR DELETE 
  USING (auth.uid() = user_id);

-- Want to go: Users can manage their own want to go list
CREATE POLICY "Users can view their own want to go" 
  ON want_to_go FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own want to go" 
  ON want_to_go FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own want to go" 
  ON want_to_go FOR DELETE 
  USING (auth.uid() = user_id);

-- ==================================================
-- DONE!
-- ==================================================
-- You now have ~4000 Michelin restaurants loaded into 
-- the unified locations table. The table is ready to 
-- receive LV editor ratings and user ratings.
```

## What This Migration Does

1. **Creates Unified Table**: Single `locations` table with all venue data
2. **Migrates Michelin Data**: Imports all ~4000 Michelin restaurants 
3. **Preserves External IDs**: Keeps both `google_place_id` and `michelin_id`
4. **Adds User Ratings**: New `user_ratings` table with automatic score aggregation
5. **Performance Optimized**: Proper indexes on all lookup columns
6. **Maintains Security**: RLS policies for proper access control

## After Running Migration

The backend and frontend code will be updated to:
- Use the unified schema
- Query single table instead of joining multiple tables
- Support upsert operations when adding new locations
- Handle Michelin data discovery seamlessly