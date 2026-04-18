# Le Voyageur - Database Setup Instructions

## Step 1: Run the Migration SQL

1. **Open Supabase Dashboard** → SQL Editor
2. **Copy and paste** the entire contents of `/SUPABASE_MIGRATION.sql`
3. **Click "Run"**
4. **Verify** you see: `Migration completed successfully! ✅`

This migration will:
- ✅ Create the `want_to_go` table
- ✅ Add all missing foreign key constraints
- ✅ Add unique constraints to prevent duplicate favorites/want-to-go
- ✅ Create performance indexes
- ✅ Enable Row Level Security (RLS) on all tables
- ✅ Set up RLS policies for security

---

## Step 2: Verify the Tables

Run this query to confirm everything is set up:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**You should see:**
- ✅ `favorites`
- ✅ `locations`
- ✅ `user_metadata`
- ✅ `user_ratings`
- ✅ `want_to_go`

---

## Step 3: Test the New Backend

The backend has been completely rewritten to use real database tables instead of the KV store.

### What Changed:

**Before:** KV Store (key-value pairs)
```typescript
await kv.get('location:123');
await kv.set('favorite:user:location', {...});
```

**After:** Real Postgres Tables
```typescript
const { data } = await supabase
  .from('locations')
  .select('*');
  
await supabase
  .from('favorites')
  .insert({ user_id, location_id });
```

### All Routes Now Use Database:

1. ✅ `GET /locations` - Queries `locations` table
2. ✅ `GET /locations/tag/:tag` - Filters by PostgreSQL array
3. ✅ `GET /favorites` - Joins `favorites` + `locations` tables
4. ✅ `POST /favorites/:id` - Inserts into `favorites` table
5. ✅ `DELETE /favorites/:id` - Deletes from `favorites` table
6. ✅ `GET /want-to-go` - Joins `want_to_go` + `locations` tables
7. ✅ `POST /want-to-go/:id` - Inserts into `want_to_go` table
8. ✅ `DELETE /want-to-go/:id` - Deletes from `want_to_go` table
9. ✅ `GET /user` - Queries `user_metadata` table
10. ✅ `POST /locations` - Inserts into `locations` table (editors only)
11. ✅ `PUT /locations/:id` - Updates `locations` table (editors only)
12. ✅ Editor role verification - Queries `user_metadata.role`

---

## Step 4: Understanding the Security Model

### Row Level Security (RLS)

RLS ensures users can only access their own data:

- **Favorites:** Users can only view/add/remove their own favorites
- **Want to Go:** Users can only view/add/remove their own want-to-go items
- **Locations:** Anyone can read, only editors can create/update
- **User Metadata:** Users can only see their own profile

### Foreign Keys

All relationships use `ON DELETE CASCADE`:
- If a location is deleted, all favorites/want-to-go for that location are auto-deleted
- If a user is deleted (via Supabase Auth), all their favorites/want-to-go are auto-deleted

---

## Step 5: Seed Some Data (Optional)

To add sample locations for testing:

**Call the seed endpoint:**
```bash
POST /make-server-48182530/seed
```

Or run this SQL directly:

```sql
INSERT INTO locations (name, lat, lng, lv_editors_score, lv_crowdsource_score, google_rating, michelin_score, tags, description)
VALUES 
  ('Addison', 32.9530, -117.2394, 9.5, 9.2, 4.8, 0, ARRAY['fine dining', 'french', 'del mar'], 'Refined California-French cuisine in an elegant setting'),
  ('Animae', 32.7142, -117.1625, 8.8, 8.5, 4.6, 0, ARRAY['asian fusion', 'cocktails', 'downtown'], 'Modern Asian fusion with creative cocktails'),
  ('Born & Raised', 32.7165, -117.1611, 9.0, 8.8, 4.7, 0, ARRAY['steakhouse', 'rooftop', 'little italy'], 'Classic steakhouse with stunning rooftop views');
```

---

## Step 6: Final Schema Reference

See `/SUPABASE_SCHEMA.md` for complete documentation of:
- All table structures
- Column types and constraints
- Foreign key relationships
- RLS policies
- Sample data formats

---

## Troubleshooting

### Issue: "relation does not exist"
**Solution:** Run the migration SQL in Step 1

### Issue: "permission denied for table"
**Solution:** RLS policies might be blocking. Check that you're logged in and using correct auth token

### Issue: "duplicate key value violates unique constraint"
**Solution:** This is expected! It means you're trying to add a duplicate favorite/want-to-go. The API will return `success: true` anyway.

### Issue: "Forbidden - Editor role required"
**Solution:** Your user's role in `user_metadata` table must be `'editor'`. Update it with:
```sql
UPDATE user_metadata SET role = 'editor' WHERE email = 'your@email.com';
```

---

## Next Steps

After completing the migration:

1. ✅ Test the app - all features should work exactly the same
2. ✅ Favorites/Want-to-go lists should now persist in the database
3. ✅ Editor features should respect the role from `user_metadata` table
4. ✅ The KV store is no longer used (except for the protected kv_store.tsx file)

---

## Important Notes

- **No more KV store dependency** - all data is in proper relational tables
- **Better performance** - database indexes speed up queries
- **Data integrity** - foreign keys prevent orphaned data
- **Security** - RLS policies protect user data
- **Scalability** - PostgreSQL can handle millions of records

🎉 **Your database is now production-ready!**
