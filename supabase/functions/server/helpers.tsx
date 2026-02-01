/**
 * Helper functions for data transformation between database and API
 */

// Database row type (snake_case from Supabase)
export interface LocationRow {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  lat: number;
  lng: number;
  category?: string | null;
  tags?: string[] | null;
  google_rating?: number | null;
  google_ratings_count?: number | null;
  michelin_stars?: number | null;
  michelin_distinction?: string | null;
  michelin_green_star?: boolean | null;
  michelin_price?: string | null;
  michelin_cuisine?: string | null;
  lv_editor_score?: number | null;
  lv_editor_notes?: string | null;
  lv_avg_user_score?: number | null;
  lv_user_ratings_count?: number | null;
  cuisine?: string | null;
  area?: string | null;
  image?: string | null;
  description?: string | null;
  google_place_id?: string | null;
  michelin_id?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_user_id?: string | null;
  updated_by_user_id?: string | null;
}

// API response type (camelCase for frontend)
export interface LocationAPI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  // LV ratings
  lvEditorScore?: number | null;
  lvEditorNotes?: string | null;
  lvAvgUserScore?: number | null; // Renamed from lvCrowdsourceScore
  lvUserRatingsCount?: number;
  // External ratings
  googleRating?: number | null;
  googleRatingsCount?: number;
  michelinStars?: number | null;
  michelinDistinction?: string | null;
  michelinGreenStar?: boolean;
  // Core data
  tags: string[];
  category?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  cuisine?: string | null;
  area?: string | null;
  image?: string | null;
  // External IDs
  googlePlaceId?: string | null;
  michelinId?: string | null;
  placeId?: string | null; // Backward compat alias for googlePlaceId
  // Metadata
  createdBy?: string | null;
  createdAt?: string;
  updatedBy?: string | null;
  updatedAt?: string;
  favoritesCount?: number;
  
  // Deprecated fields for backward compatibility
  lvEditorsScore?: number | null; // Alias for lvEditorScore
  lvCrowdsourceScore?: number | null; // Alias for lvAvgUserScore
  michelinScore?: number | null; // Derived from stars/distinction
}

/**
 * Convert database row (snake_case) to API format (camelCase)
 */
export function formatLocationForAPI(loc: LocationRow, favoritesCount?: number): LocationAPI {
  // Calculate legacy michelinScore for backward compatibility
  let michelinScore: number | null = null;
  if (loc.michelin_stars) {
    michelinScore = loc.michelin_stars;
  } else if (loc.michelin_distinction?.toLowerCase().includes('bib gourmand')) {
    michelinScore = 0.5;
  }
  
  return {
    id: loc.id,
    name: loc.name,
    lat: loc.lat,
    lng: loc.lng,
    // LV ratings (new naming)
    lvEditorScore: loc.lv_editor_score,
    lvEditorNotes: loc.lv_editor_notes,
    lvAvgUserScore: loc.lv_avg_user_score,
    lvUserRatingsCount: loc.lv_user_ratings_count || 0,
    // External ratings
    googleRating: loc.google_rating,
    googleRatingsCount: loc.google_ratings_count || 0,
    michelinStars: loc.michelin_stars,
    michelinDistinction: loc.michelin_distinction,
    michelinGreenStar: loc.michelin_green_star || false,
    // Core data
    tags: loc.tags || [],
    category: loc.category,
    description: loc.description,
    address: loc.address,
    city: loc.city,
    country: loc.country,
    cuisine: loc.cuisine || loc.michelin_cuisine,
    area: loc.area,
    image: loc.image,
    // External IDs
    googlePlaceId: loc.google_place_id,
    michelinId: loc.michelin_id,
    placeId: loc.google_place_id, // Backward compat alias
    // Metadata
    createdBy: loc.created_by_user_id,
    createdAt: loc.created_at,
    updatedBy: loc.updated_by_user_id,
    updatedAt: loc.updated_at,
    favoritesCount: favoritesCount || 0,
    
    // Deprecated fields for backward compatibility
    lvEditorsScore: loc.lv_editor_score, // Alias
    lvCrowdsourceScore: loc.lv_avg_user_score, // Alias  
    michelinScore: michelinScore, // Derived
  };
}

/**
 * Convert API update payload (camelCase) to database format (snake_case)
 */
export function formatLocationForDB(updates: any): any {
  const dbUpdates: any = {};
  
  // Map camelCase to snake_case
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.address !== undefined) dbUpdates.address = updates.address;
  if (updates.city !== undefined) dbUpdates.city = updates.city;
  if (updates.country !== undefined) dbUpdates.country = updates.country;
  if (updates.lat !== undefined) dbUpdates.lat = updates.lat;
  if (updates.lng !== undefined) dbUpdates.lng = updates.lng;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.cuisine !== undefined) dbUpdates.cuisine = updates.cuisine;
  if (updates.area !== undefined) dbUpdates.area = updates.area;
  if (updates.image !== undefined) dbUpdates.image = updates.image;
  
  // LV ratings (new naming - prefer these)
  if (updates.lvEditorScore !== undefined) dbUpdates.lv_editor_score = updates.lvEditorScore;
  if (updates.lvEditorNotes !== undefined) dbUpdates.lv_editor_notes = updates.lvEditorNotes;
  if (updates.lvAvgUserScore !== undefined) dbUpdates.lv_avg_user_score = updates.lvAvgUserScore;
  if (updates.lvUserRatingsCount !== undefined) dbUpdates.lv_user_ratings_count = updates.lvUserRatingsCount;
  
  // External ratings
  if (updates.googleRating !== undefined) dbUpdates.google_rating = updates.googleRating;
  if (updates.googleRatingsCount !== undefined) dbUpdates.google_ratings_count = updates.googleRatingsCount;
  if (updates.michelinStars !== undefined) dbUpdates.michelin_stars = updates.michelinStars;
  if (updates.michelinDistinction !== undefined) dbUpdates.michelin_distinction = updates.michelinDistinction;
  if (updates.michelinGreenStar !== undefined) dbUpdates.michelin_green_star = updates.michelinGreenStar;
  
  // External IDs
  if (updates.googlePlaceId !== undefined) dbUpdates.google_place_id = updates.googlePlaceId;
  if (updates.placeId !== undefined) dbUpdates.google_place_id = updates.placeId; // Backward compat
  if (updates.michelinId !== undefined) dbUpdates.michelin_id = updates.michelinId;
  
  // Backward compatibility - support old field names
  if (updates.lvEditorsScore !== undefined && dbUpdates.lv_editor_score === undefined) {
    dbUpdates.lv_editor_score = updates.lvEditorsScore;
  }
  if (updates.lvCrowdsourceScore !== undefined && dbUpdates.lv_avg_user_score === undefined) {
    dbUpdates.lv_avg_user_score = updates.lvCrowdsourceScore;
  }
  // Note: michelinScore is deprecated, use michelinStars/michelinDistinction instead
  if (updates.michelinScore !== undefined) {
    // Try to interpret old michelinScore
    const score = updates.michelinScore;
    if (score === 0.5) {
      dbUpdates.michelin_distinction = 'Bib Gourmand';
    } else if (score >= 1 && score <= 3) {
      dbUpdates.michelin_stars = Math.floor(score);
    }
  }
  
  return dbUpdates;
}
