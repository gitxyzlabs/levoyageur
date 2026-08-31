-- ============================================
-- MICHELIN RESTAURANTS TABLE SETUP
-- ============================================
-- Run this SQL in Supabase Dashboard → SQL Editor

-- Create Michelin restaurants table with column names matching CSV headers
CREATE TABLE michelin_restaurants (
  id BIGSERIAL PRIMARY KEY,
  
  -- CSV columns (exact names from your CSV)
  "Name" TEXT NOT NULL,
  "Address" TEXT,
  "Location" TEXT, -- "City, Country" format
  "Price" TEXT, -- € symbols from Michelin
  "Cuisine" TEXT,
  "Longitude" DOUBLE PRECISION,
  "Latitude" DOUBLE PRECISION,
  "PhoneNumber" TEXT,
  "Url" TEXT, -- Michelin Guide URL
  "WebsiteUrl" TEXT, -- Restaurant website
  "Award" TEXT, -- "1 Stars", "2 Stars", "3 Stars", "Bib Gourmand"
  "GreenStar" INTEGER, -- 0 or 1
  "FacilitiesAndServices" TEXT,
  "Description" TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast geospatial queries
CREATE INDEX idx_michelin_coordinates ON michelin_restaurants("Latitude", "Longitude");

-- Create index for location searches
CREATE INDEX idx_michelin_location ON michelin_restaurants("Location");

-- Create index for award filtering
CREATE INDEX idx_michelin_award ON michelin_restaurants("Award");

-- Prevent duplicate restaurants (same name in same location)
CREATE UNIQUE INDEX idx_michelin_unique ON michelin_restaurants(LOWER("Name"), LOWER("Location"));

-- Add a comment explaining the table
COMMENT ON TABLE michelin_restaurants IS 'Reference table for Michelin Guide restaurants worldwide. Used for automatic Michelin rating lookups when viewing locations on the map.';
