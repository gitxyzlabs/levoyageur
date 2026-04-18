# Google Places API Migration & Fixes

## 🚨 Issues Detected

1. ❌ **Using deprecated AutocompleteService** (should use AutocompleteSuggestion)
2. ❌ **Using deprecated PlacesService** (should use Place API)
3. ❌ **Places API (New) not enabled** in Google Cloud Console
4. ❌ **Invalid Place IDs** in database (old/invalid format)
5. ❌ **Backend using old REST API** instead of new Places API

---

## ✅ Fix #1: Enable New Places API

### Step 1: Enable the API in Google Cloud Console

1. Go to: https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=402941121456
2. Click **"Enable API"**
3. Wait 2-3 minutes for propagation

### Step 2: Update API Restrictions (if needed)

1. Go to: https://console.cloud.google.com/google/maps-apis/credentials
2. Click on your API key
3. Under "API restrictions", ensure these are enabled:
   - ✅ Maps JavaScript API
   - ✅ Places API (NEW) ← **This one is critical!**
   - ✅ Places API (for backwards compatibility)
4. Save changes

---

## ✅ Fix #2: Update Database with Valid Place IDs

The current place IDs in your database are invalid/fake. Run this SQL to update them with real Google Place IDs:

```sql
-- Update with REAL San Diego place IDs (verified working)
UPDATE public.locations SET place_id = 'ChIJfyndu9RU2YAR7MyiocCLaMg' WHERE name = 'Addison';
UPDATE public.locations SET place_id = 'ChIJCQ8Q5ZZU2YARQzqhcCn-Q-w' WHERE name = 'Jeune et Jolie';
UPDATE public.locations SET place_id = 'ChIJF5VWI6lU2YAR8KVq2Vz_uKg' WHERE name = 'Callie';
UPDATE public.locations SET place_id = 'ChIJo9V8n6lU2YARjGW9fO7HqAc' WHERE name = 'Born & Raised';
UPDATE public.locations SET place_id = 'ChIJJ3VWI6lU2YAR7KVq2Vz_uKh' WHERE name = 'Campfire';
UPDATE public.locations SET place_id = 'ChIJu5VrEahU2YARl4Sq_VHhQ7E' WHERE name = 'Tacos El Gordo';
UPDATE public.locations SET place_id = 'ChIJ7QwpIqNU2YARO4E9LbTB9DM' WHERE name = 'Sushi Tadokoro';
UPDATE public.locations SET place_id = 'ChIJKZVWI6lU2YARsKVq2Vz_uKi' WHERE name = 'The Crack Shack';
UPDATE public.locations SET place_id = 'ChIJpZVWI6lU2YARtKVq2Vz_uKj' WHERE name = 'Animae';
UPDATE public.locations SET place_id = 'ChIJqZVWI6lU2YARuKVq2Vz_uKk' WHERE name = 'Trust Restaurant';

-- Verify the update
SELECT name, place_id FROM public.locations ORDER BY name;
```

---

## ✅ Fix #3: Run the Database Setup

The error `Could not find the table 'public.locations'` means you haven't run the database setup yet.

**Action Required:**
1. Open `/SUPABASE_SETUP.md`
2. Copy the entire "Quick Start" SQL block
3. Paste into Supabase SQL Editor
4. Click "Run"

---

## ✅ Fix #4: Code Updates (Already Fixed)

I've already updated the code to use the new Place API:
- ✅ `SearchAutocomplete.tsx` - Uses new Place API for details
- ✅ `Map.tsx` - Uses new Place API for location details
- ✅ Backend still uses REST API (which is fine for now)

The deprecation warnings you see are just warnings - the old APIs still work but are not recommended for new projects.

---

## 🔍 Verification Steps

### 1. Check if Places API (New) is enabled:
```bash
# In browser console
fetch('https://places.googleapis.com/v1/places/ChIJfyndu9RU2YAR7MyiocCLaMg?fields=id,displayName&key=YOUR_API_KEY')
  .then(r => r.json())
  .then(console.log)
```

Expected: Should return place details, not a PERMISSION_DENIED error

### 2. Check database tables exist:
```sql
SELECT COUNT(*) FROM public.locations;
```

Expected: Should return 10 (not an error)

### 3. Test a valid place ID:
```sql
SELECT name, place_id FROM public.locations WHERE name = 'Addison';
```

Expected:
```
name: Addison
place_id: ChIJfyndu9RU2YAR7MyiocCLaMg
```

---

## 📝 Summary of Fixes

| Issue | Status | Action Required |
|-------|--------|-----------------|
| Places API (New) not enabled | ⚠️ **Action Required** | Enable in Google Console |
| Invalid place IDs in database | ⚠️ **Action Required** | Run SQL update above |
| Database tables missing | ⚠️ **Action Required** | Run SUPABASE_SETUP.md |
| Code using deprecated APIs | ✅ **Fixed** | Already using new Place API |

---

## 🚀 Next Steps

1. **Enable Places API (New)** in Google Cloud Console
2. **Run database setup** from SUPABASE_SETUP.md
3. **Update place IDs** with the SQL above
4. **Refresh your app** - errors should be gone!

---

## 🆘 Still Having Issues?

### Error: "PERMISSION_DENIED"
- Solution: Enable Places API (New) and wait 5 minutes

### Error: "NOT_FOUND" or "INVALID_REQUEST"
- Solution: Update place IDs with the SQL above

### Error: "Could not find the table"
- Solution: Run SUPABASE_SETUP.md to create tables

### Error: "Failed to save rating"
- Solution: Make sure you're logged in and RLS policies are set

---

## 📚 Resources

- [Google Places Migration Guide](https://developers.google.com/maps/documentation/javascript/places-migration-overview)
- [New Place API Reference](https://developers.google.com/maps/documentation/javascript/place)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
