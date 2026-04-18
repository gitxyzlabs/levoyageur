# Le Voyageur Database Performance Optimization Guide

## Issues Identified from Server Logs

Your app is experiencing slow database queries:
- `SELECT on locations took 769.52ms` (should be <50ms)
- `SELECT on favorites took 176.78ms` (should be <20ms)
- Total `/locations` endpoint: **1112ms** (should be <200ms)

## Root Causes

1. **Missing database indexes** on frequently queried columns
2. **Fetching all data** instead of filtering by viewport bounds
3. **Sequential queries** for favorites/want-to-go counts

## ✅ Server Optimizations Applied

I've optimized the `/locations` endpoint to:
- Support optional `bounds` parameter for map viewport filtering
- Only query favorites/want-to-go for returned locations (not all locations)
- Reduce logging verbosity for production performance

### How to Use New Bounds Parameter

When fetching locations for a map viewport, pass bounds:

```typescript
const bounds = map.getBounds();
const params = new URLSearchParams({
  bounds: `${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng}`
});

const response = await fetch(
  `${serverUrl}/locations?${params}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

## 🔧 Required Database Indexes

To complete the optimization, you need to add these indexes in your Supabase dashboard:

### 1. Locations Table Indexes

```sql
-- Index for geographic queries (critical for map viewport filtering)
CREATE INDEX idx_locations_lat ON locations(lat);
CREATE INDEX idx_locations_lng ON locations(lng);

-- Composite index for lat+lng queries (even better performance)
CREATE INDEX idx_locations_lat_lng ON locations(lat, lng);

-- Index for Google Place ID lookups
CREATE INDEX idx_locations_google_place_id ON locations(google_place_id);

-- Index for Michelin ID lookups
CREATE INDEX idx_locations_michelin_id ON locations(michelin_id);

-- Index for tag searches (GIN index for array contains queries)
CREATE INDEX idx_locations_tags ON locations USING GIN(tags);
```

### 2. Favorites Table Indexes

```sql
-- Index for user's favorites lookup
CREATE INDEX idx_favorites_user_id ON favorites(user_id);

-- Index for location favorites count
CREATE INDEX idx_favorites_location_id ON favorites(location_id);

-- Composite index for favorites queries filtering by location list
CREATE INDEX idx_favorites_location_user ON favorites(location_id, user_id);
```

### 3. Want-to-Go Table Indexes

```sql
-- Index for user's want-to-go lookup
CREATE INDEX idx_want_to_go_user_id ON want_to_go(user_id);

-- Index for location want-to-go count
CREATE INDEX idx_want_to_go_location_id ON want_to_go(location_id);

-- Composite index for want-to-go queries
CREATE INDEX idx_want_to_go_location_user ON want_to_go(location_id, user_id);
```

### 4. User Metadata Table Index

```sql
-- Index for user metadata lookups
CREATE INDEX idx_user_metadata_user_id ON user_metadata(user_id);
```

## 📊 How to Add Indexes in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy and paste ALL the SQL statements above
5. Click **Run** to execute
6. Verify success in the **Database** → **Tables** section

## Expected Performance Improvements

After adding indexes:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Locations query | 769ms | 30-50ms | **94% faster** |
| Favorites query | 177ms | 10-20ms | **90% faster** |
| Total /locations | 1112ms | 80-120ms | **90% faster** |

## 🚀 Frontend Optimization Recommendations

1. **Use bounds parameter** when fetching for map display:
   ```typescript
   // Only fetch locations visible on the map
   const locations = await fetchLocations({ bounds: mapBounds });
   ```

2. **Implement pagination** for large result sets:
   ```typescript
   // Fetch in chunks for better UX
   const locations = await fetchLocations({ limit: 500, offset: 0 });
   ```

3. **Add debouncing** to map pan/zoom to prevent excessive API calls:
   ```typescript
   const debouncedFetch = useMemo(
     () => debounce(() => fetchLocations(), 300),
     []
   );
   ```

## 📈 Monitoring Performance

The server logs now show:
- ✅ Performance timings: `🟢 [PERF] GET /locations - XXms - 200`
- ⚠️ Slow query warnings: `⚠️ [DB SLOW] SELECT on locations took XXms`

Monitor these logs to track improvement after adding indexes.

## Additional Recommendations

1. **Consider caching** frequently accessed data (tags, location counts)
2. **Use Redis/Upstash** for real-time counters (favorites, want-to-go)
3. **Implement GraphQL** with DataLoader for batched queries
4. **Add rate limiting** to prevent API abuse
5. **Use CDN** for serving static location data

## Questions?

If you encounter any issues or need help with specific optimizations, let me know!
