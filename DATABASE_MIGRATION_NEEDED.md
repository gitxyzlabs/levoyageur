# Database Migration Required

## Place ID Validation Feature

To enable the Michelin Place ID validation feature, you need to create the following table in your Supabase database:

### SQL Migration

```sql
-- Create place_id_validations table (idempotent)
CREATE TABLE IF NOT EXISTS place_id_validations (
  id SERIAL PRIMARY KEY,
  michelin_id INTEGER NOT NULL REFERENCES michelin_restaurants(id),
  suggested_place_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('confirmed', 'rejected', 'unsure')),
  vote_weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(michelin_id, suggested_place_id, user_id)
);

-- Create indexes for better query performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_place_id_validations_michelin_id ON place_id_validations(michelin_id);
CREATE INDEX IF NOT EXISTS idx_place_id_validations_suggested_place_id ON place_id_validations(suggested_place_id);
CREATE INDEX IF NOT EXISTS idx_place_id_validations_user_id ON place_id_validations(user_id);
CREATE INDEX IF NOT EXISTS idx_place_id_validations_status ON place_id_validations(validation_status);

-- Enable Row Level Security
ALTER TABLE place_id_validations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make this idempotent)
DROP POLICY IF EXISTS "Users can view all validations" ON place_id_validations;
DROP POLICY IF EXISTS "Authenticated users can insert validations" ON place_id_validations;
DROP POLICY IF EXISTS "Users can update own validations" ON place_id_validations;

-- Policy: Users can view all validations (for transparency)
CREATE POLICY "Users can view all validations"
  ON place_id_validations
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert their own validations
CREATE POLICY "Authenticated users can insert validations"
  ON place_id_validations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update only their own validations
CREATE POLICY "Users can update own validations"
  ON place_id_validations
  FOR UPDATE
  USING (auth.uid() = user_id);
```

### How to Apply

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL above
4. Run the migration

### What This Enables

- Users can validate suggested Google Place IDs for Michelin restaurants
- Validation votes are weighted (editors get 2x vote weight)
- After 1+ weighted confirmations (with more confirmations than rejections), the GooglePlaceId is auto-updated
- Threshold is currently set low for testing - can be increased to 3+ for production
- Crowd-sourced data validation improves location accuracy over time