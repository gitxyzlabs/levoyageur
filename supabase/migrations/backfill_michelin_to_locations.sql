-- ============================================
-- Michelin Data Backfill to Locations Table
-- ============================================
-- This migration syncs all Michelin restaurants to the locations table
-- Only links Place IDs when name and address match to avoid data errors

-- Start transaction
BEGIN;

-- Step 1: Update existing locations that have a michelin_id match
-- This is always safe since michelin_id is our source of truth
-- We do NOT touch google_place_id at all to avoid any duplicate conflicts
UPDATE locations
SET
  michelin_stars = CASE
    WHEN mr."Award" LIKE '%3 Star%' THEN 3
    WHEN mr."Award" LIKE '%2 Star%' THEN 2
    WHEN mr."Award" LIKE '%1 Star%' THEN 1
    ELSE NULL
  END,
  michelin_distinction = CASE
    WHEN mr."Award" LIKE '%Bib Gourmand%' THEN 'Bib Gourmand'
    WHEN mr."Award" LIKE '%Selected%' OR mr."Award" LIKE '%Plate%' THEN 'Michelin Plate'
    ELSE NULL
  END,
  michelin_green_star = (mr."GreenStar" = 1),
  michelin_cuisine = mr."Cuisine",
  michelin_price = mr."Price",
  michelin_description = mr."Description",
  michelin_url = mr."Url",
  michelin_website_url = mr."WebsiteUrl",
  michelin_phone_number = mr."PhoneNumber",
  michelin_facilities = mr."FacilitiesAndServices",
  updated_at = NOW()
FROM michelin_restaurants mr
WHERE locations.michelin_id = mr.id::text;

-- Step 2: Update existing locations by NAME similarity (not Place ID)
-- This links Michelin data to manually-created locations that don't have michelin_id yet
UPDATE locations
SET
  michelin_id = mr.id::text,
  michelin_stars = CASE
    WHEN mr."Award" LIKE '%3 Star%' THEN 3
    WHEN mr."Award" LIKE '%2 Star%' THEN 2
    WHEN mr."Award" LIKE '%1 Star%' THEN 1
    ELSE NULL
  END,
  michelin_distinction = CASE
    WHEN mr."Award" LIKE '%Bib Gourmand%' THEN 'Bib Gourmand'
    WHEN mr."Award" LIKE '%Selected%' OR mr."Award" LIKE '%Plate%' THEN 'Michelin Plate'
    ELSE NULL
  END,
  michelin_green_star = (mr."GreenStar" = 1),
  michelin_cuisine = mr."Cuisine",
  michelin_price = mr."Price",
  michelin_description = mr."Description",
  michelin_url = mr."Url",
  michelin_website_url = mr."WebsiteUrl",
  michelin_phone_number = mr."PhoneNumber",
  michelin_facilities = mr."FacilitiesAndServices",
  updated_at = NOW()
FROM michelin_restaurants mr
WHERE locations.michelin_id IS NULL
  -- Match by name (exact or very similar)
  AND (
    LOWER(TRIM(locations.name)) = LOWER(TRIM(mr."Name"))
    OR similarity(locations.name, mr."Name") > 0.8
  )
  -- Optional: Address similarity as additional validation
  AND (
    locations.address IS NULL
    OR mr."Address" IS NULL
    OR similarity(locations.address, mr."Address") > 0.5
  );

-- Step 3: Insert new locations for Michelin restaurants
-- We ONLY check names for duplicates - ignore Place IDs completely for deduplication
-- Any Place ID conflict = force NULL and create separate entries
WITH michelin_candidates AS (
  SELECT 
    mr.id as mr_id,
    mr."Name" as mr_name,
    mr."Address" as mr_address,
    mr."Latitude" as mr_lat,
    mr."Longitude" as mr_lng,
    mr."Cuisine" as mr_cuisine,
    mr."Price" as mr_price,
    mr."Description" as mr_description,
    mr."Url" as mr_url,
    mr."WebsiteUrl" as mr_website_url,
    mr."PhoneNumber" as mr_phone_number,
    mr."FacilitiesAndServices" as mr_facilities,
    CASE
      WHEN mr."Award" LIKE '%3 Star%' THEN 3
      WHEN mr."Award" LIKE '%2 Star%' THEN 2
      WHEN mr."Award" LIKE '%1 Star%' THEN 1
      ELSE NULL
    END as mr_stars,
    CASE
      WHEN mr."Award" LIKE '%Bib Gourmand%' THEN 'Bib Gourmand'
      WHEN mr."Award" LIKE '%Selected%' OR mr."Award" LIKE '%Plate%' THEN 'Michelin Plate'
      ELSE NULL
    END as mr_distinction,
    (mr."GreenStar" = 1) as mr_green_star,
    TRIM(mr.google_place_id) as clean_place_id
  FROM michelin_restaurants mr
  WHERE NOT EXISTS (
    -- Only check if this exact michelin_id already exists
    -- Do NOT check Place ID here - we handle that below
    SELECT 1 FROM locations
    WHERE locations.michelin_id = mr.id::text
  )
  AND mr."Latitude" IS NOT NULL 
  AND mr."Longitude" IS NOT NULL
)
INSERT INTO locations (
  google_place_id,
  michelin_id,
  name,
  address,
  lat,
  lng,
  michelin_stars,
  michelin_distinction,
  michelin_green_star,
  michelin_cuisine,
  michelin_price,
  michelin_description,
  michelin_url,
  michelin_website_url,
  michelin_phone_number,
  michelin_facilities,
  created_at,
  updated_at
)
SELECT 
  -- ALWAYS force Place ID to NULL to avoid any conflicts
  -- We can manually link these later through the UI
  NULL as final_place_id,
  mc.mr_id::text,
  mc.mr_name,
  mc.mr_address,
  mc.mr_lat,
  mc.mr_lng,
  mc.mr_stars,
  mc.mr_distinction,
  mc.mr_green_star,
  mc.mr_cuisine,
  mc.mr_price,
  mc.mr_description,
  mc.mr_url,
  mc.mr_website_url,
  mc.mr_phone_number,
  mc.mr_facilities,
  NOW(),
  NOW()
FROM michelin_candidates mc;

-- Commit transaction
COMMIT;