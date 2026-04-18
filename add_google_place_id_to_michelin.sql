-- ============================================
-- ADD GOOGLE PLACE ID TO MICHELIN RESTAURANTS
-- ============================================
-- Run this SQL in Supabase Dashboard → SQL Editor
-- This adds a column to store discovered Google Place IDs for Michelin restaurants

-- Use snake_case for PostgreSQL/Supabase best practices
ALTER TABLE michelin_restaurants 
ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_michelin_google_place_id 
ON michelin_restaurants(google_place_id);

-- Add comment
COMMENT ON COLUMN michelin_restaurants.google_place_id IS 'Google Place ID discovered via Places API for accurate integration with Google Maps';
