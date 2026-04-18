# Michelin Data Duplicate Investigation

## Finding Duplicate Google Place IDs

### Query 1: Find all duplicate google_place_ids in michelin_restaurants

```sql
-- Find google_place_ids that appear multiple times in michelin_restaurants
SELECT 
  google_place_id,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as michelin_ids,
  STRING_AGG("Name", ' | ') as names
FROM michelin_restaurants
WHERE google_place_id IS NOT NULL
GROUP BY google_place_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

**What this shows:** All Place IDs that have multiple Michelin records, with the count and names.

---

### Query 2: Get full details of a specific duplicate

```sql
-- Get all details for that specific duplicate Place ID
SELECT 
  id,
  "Name",
  "Address",
  "Award",
  google_place_id,
  "Latitude",
  "Longitude",
  created_at
FROM michelin_restaurants
WHERE google_place_id = 'ChIJte0b2xux2YgRr8f-xaLb0jw'
ORDER BY id;
```

**Replace the Place ID** with the one you found in Query 1.

---

### Query 3: Count total duplicates

```sql
-- How many total duplicate records exist?
SELECT 
  COUNT(*) as total_duplicate_records
FROM (
  SELECT google_place_id
  FROM michelin_restaurants
  WHERE google_place_id IS NOT NULL
  GROUP BY google_place_id
  HAVING COUNT(*) > 1
) duplicates
INNER JOIN michelin_restaurants mr ON mr.google_place_id = duplicates.google_place_id;
```

---

### Query 4: Find duplicates by michelin_id

```sql
-- Check if michelin_id has duplicates (it shouldn't!)
SELECT 
  id,
  COUNT(*) as count
FROM michelin_restaurants
GROUP BY id
HAVING COUNT(*) > 1;
```

---

## Decision Tree

Once you run Query 1 and 2, you'll see what type of duplicates you have:

### Option A: Same restaurant, duplicate records
- **Fix:** Delete the duplicate(s), keep one
- **Query to delete:**
```sql
-- Delete duplicates, keeping the lowest ID (oldest record)
DELETE FROM michelin_restaurants
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY google_place_id ORDER BY id) as rn
    FROM michelin_restaurants
    WHERE google_place_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);
```

### Option B: Different restaurants, same Place ID (data error)
- **Fix:** One of the Place IDs is wrong - need to re-run Place ID discovery
- **Query to clear bad Place IDs:**
```sql
-- Clear google_place_id for specific Michelin IDs
UPDATE michelin_restaurants
SET google_place_id = NULL
WHERE id IN (123, 456); -- Replace with the wrong IDs
```

### Option C: Multiple locations of same restaurant
- **Fix:** These SHOULD have different Place IDs - re-discover them
- **Action:** Re-run Step 2 (Discover Place IDs) for these records

---

## Quick Stats

```sql
-- Overview of your michelin_restaurants data quality
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT google_place_id) as unique_place_ids,
  COUNT(google_place_id) as records_with_place_id,
  COUNT(*) - COUNT(google_place_id) as records_missing_place_id,
  (SELECT COUNT(*) FROM (
    SELECT google_place_id
    FROM michelin_restaurants
    WHERE google_place_id IS NOT NULL
    GROUP BY google_place_id
    HAVING COUNT(*) > 1
  ) dups) as place_ids_with_duplicates
FROM michelin_restaurants;
```
