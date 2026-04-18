-- ================================================================
-- LE VOYAGEUR - FIX DEFAULT RATINGS MIGRATION
-- ================================================================
-- This migration removes the DEFAULT 0 constraint from rating columns
-- and allows NULL values so locations can be created without ratings
-- ================================================================

-- Remove DEFAULT constraints and allow NULL for LV scores
ALTER TABLE public.locations 
  ALTER COLUMN lv_editors_score DROP DEFAULT,
  ALTER COLUMN lv_crowdsource_score DROP DEFAULT,
  ALTER COLUMN google_rating DROP DEFAULT,
  ALTER COLUMN michelin_score DROP DEFAULT;

-- Set NOT NULL to false (allow NULL values)
ALTER TABLE public.locations 
  ALTER COLUMN lv_editors_score DROP NOT NULL,
  ALTER COLUMN lv_crowdsource_score DROP NOT NULL,
  ALTER COLUMN google_rating DROP NOT NULL,
  ALTER COLUMN michelin_score DROP NOT NULL;

-- Update existing locations that have 0 scores to NULL (optional - only if you want to clean up existing data)
-- Uncomment the following lines if you want to convert existing 0 values to NULL:
-- UPDATE public.locations SET lv_editors_score = NULL WHERE lv_editors_score = 0;
-- UPDATE public.locations SET lv_crowdsource_score = NULL WHERE lv_crowdsource_score = 0;
-- UPDATE public.locations SET google_rating = NULL WHERE google_rating = 0;
-- UPDATE public.locations SET michelin_score = NULL WHERE michelin_score = 0;

COMMIT;
