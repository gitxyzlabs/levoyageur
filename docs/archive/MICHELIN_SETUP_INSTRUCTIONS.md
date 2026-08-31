# Michelin Place ID Validation - Setup Instructions

## Database Migration Required

To enable the Michelin Place ID validation feature, you need to add a column to your database.

### Steps to Add the google_place_id Column

1. **Open Supabase Dashboard**
   - Go to your Supabase project: https://supabase.com/dashboard
   - Navigate to: **SQL Editor** (in the left sidebar)

2. **Create a New Query**
   - Click "New Query" button

3. **Copy and Paste the SQL Below**

```sql
-- Use snake_case for PostgreSQL/Supabase best practices
ALTER TABLE michelin_restaurants 
ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_michelin_google_place_id 
ON michelin_restaurants(google_place_id);

-- Add comment
COMMENT ON COLUMN michelin_restaurants.google_place_id IS 'Google Place ID discovered via Places API for accurate integration with Google Maps';
```

4. **Run the Migration**
   - Click the **RUN** button (or press Cmd/Ctrl + Enter)
   - You should see: "Success. No rows returned"

5. **Verify the Column Was Added**
   - Go to **Table Editor** → **michelin_restaurants**
   - Scroll to the right and you should see the new `google_place_id` column

## What This Enables

Once the migration is complete, the Michelin Place ID validation feature will:

- ✅ Allow users to confirm suggested Google Place IDs for Michelin restaurants
- ✅ Automatically save validated Place IDs to the database
- ✅ Display full Google Place data (photos, ratings, reviews) for Michelin locations
- ✅ Show complete Michelin information (stars, Bib Gourmand, Green Star, cuisine) in the InfoWindow

## Troubleshooting

If you see an error like:
```
Could not find the 'GooglePlaceId' column
```

This means the migration hasn't been run yet. Follow the steps above to add the column.

---

**Need Help?** If you encounter any issues, check the Supabase logs in the dashboard or reach out for support.
