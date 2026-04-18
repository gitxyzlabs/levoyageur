# Le Voyageur - Supabase Database Schema

**Final Schema Documentation** - Updated January 12, 2026

---

## Tables Overview

- ✅ `user_metadata` - User profiles and roles
- ✅ `locations` - Restaurant/hotel/venue data with LV scores
- ✅ `favorites` - User's favorited locations
- ✅ `want_to_go` - User's want-to-go list
- ✅ `user_ratings` - User-submitted ratings (contributes to LV crowdsource score)

---

## Table: `user_metadata`

Stores user profile information and role (user vs editor).

### Columns

| Column Name | Data Type | Nullable | Default | Notes |
|-------------|-----------|----------|---------|-------|
| user_id | uuid | NO | - | Primary key, references auth.users(id) |
| email | text | NO | - | User's email |
| name | text | YES | - | Display name |
| role | text | NO | 'user' | Either 'user' or 'editor' |
| created_at | timestamptz | YES | now() | Account creation time |
| updated_at | timestamptz | YES | now() | Last update time |

### Constraints
- **Primary Key:** `user_id`
- **Foreign Key:** `user_id` → `auth.users(id)` (managed by Supabase Auth)

### RLS Policies
- Users can read their own metadata only
- Editors identified by `role = 'editor'`

---

## Table: `locations`

Stores all restaurants, hotels, and venues with LV scoring data.

### Columns

| Column Name | Data Type | Nullable | Default | Notes |
|-------------|-----------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Venue name |
| description | text | YES | - | Venue description |
| lat | double precision | NO | - | Latitude |
| lng | double precision | NO | - | Longitude |
| lv_editors_score | numeric | YES | 0 | LV editors score (0.0-11.0) |
| lv_crowdsource_score | numeric | YES | 0 | LV crowd score (0.0-10.0) |
| google_rating | numeric | YES | 0 | Google rating |
| michelin_score | integer | YES | 0 | Michelin stars (0-3) |
| tags | text[] | YES | '{}' | Array of tags (e.g., ["tacos", "mexican"]) |
| cuisine | text | YES | - | Cuisine type |
| area | text | YES | - | Neighborhood/area |
| image | text | YES | - | Image URL |
| place_id | text | YES | - | Google Place ID |
| created_by | uuid | YES | - | Editor who created this location |
| created_at | timestamptz | YES | now() | Creation time |
| updated_by | uuid | YES | - | Editor who last updated |
| updated_at | timestamptz | YES | now() | Last update time |

### Constraints
- **Primary Key:** `id`
- **Indexes:** `place_id`, `created_by`

### RLS Policies
- Anyone can read locations
- Only editors can create/update locations

---

## Table: `favorites`

Tracks which locations users have favorited.

### Columns

| Column Name | Data Type | Nullable | Default | Notes |
|-------------|-----------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | User who favorited |
| location_id | uuid | NO | - | Favorited location |
| created_at | timestamptz | YES | now() | When favorited |

### Constraints
- **Primary Key:** `id`
- **Foreign Keys:**
  - `user_id` → `user_metadata(user_id)` ON DELETE CASCADE
  - `location_id` → `locations(id)` ON DELETE CASCADE
- **Unique:** `(user_id, location_id)` - prevents duplicate favorites
- **Indexes:** `user_id`, `location_id`

### RLS Policies
- Users can only view/manage their own favorites

---

## Table: `want_to_go`

Tracks which locations users want to visit.

### Columns

| Column Name | Data Type | Nullable | Default | Notes |
|-------------|-----------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | User who added to list |
| location_id | uuid | NO | - | Location to visit |
| created_at | timestamptz | YES | now() | When added |

### Constraints
- **Primary Key:** `id`
- **Foreign Keys:**
  - `user_id` → `user_metadata(user_id)` ON DELETE CASCADE
  - `location_id` → `locations(id)` ON DELETE CASCADE
- **Unique:** `(user_id, location_id)` - prevents duplicates
- **Indexes:** `user_id`, `location_id`

### RLS Policies
- Users can only view/manage their own want-to-go list

---

## Table: `user_ratings`

Stores user-submitted ratings that contribute to LV crowdsource score.

### Columns

| Column Name | Data Type | Nullable | Default | Notes |
|-------------|-----------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | User who rated |
| location_id | uuid | NO | - | Rated location |
| rating | numeric | NO | - | User's rating (0.0-10.0) |
| created_at | timestamptz | YES | now() | When first rated |
| updated_at | timestamptz | YES | now() | When last updated |

### Constraints
- **Primary Key:** `id`
- **Foreign Keys:**
  - `user_id` → `user_metadata(user_id)` ON DELETE CASCADE
  - `location_id` → `locations(id)` ON DELETE CASCADE
- **Unique:** `(user_id, location_id)` - one rating per user per location
- **Indexes:** `user_id`, `location_id`

### RLS Policies
- Users can view/manage their own ratings
- LV crowdsource score is calculated as AVG of all user ratings

---

## Database Relationships

```
auth.users (Supabase Auth)
    ↓ (id → user_id)
user_metadata
    ↓ (user_id)
    ├─→ favorites → locations
    ├─→ want_to_go → locations
    └─→ user_ratings → locations
```

---

## Security

- ✅ **Row Level Security (RLS)** enabled on all tables
- ✅ Users can only access their own favorites/want_to_go/ratings
- ✅ Only editors can create/update locations
- ✅ All foreign keys use `ON DELETE CASCADE` for data integrity

---

## Migration

Run `/SUPABASE_MIGRATION.sql` in Supabase SQL Editor to:
1. Create the `want_to_go` table
2. Add all missing foreign key constraints
3. Add unique constraints to prevent duplicates
4. Create performance indexes
5. Enable RLS policies for security

---

## Notes

- **No KV store needed** - all data is in proper relational tables
- **Tags** are stored as PostgreSQL text arrays for efficient searching
- **LV Crowdsource Score** should be recalculated when user_ratings change
- **Place ID** links to Google Maps API for additional data