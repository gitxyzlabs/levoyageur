import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncMichelinData, getMichelinRating } from "./michelin.tsx";

/**
 * IMPORTANT: Platform-level JWT verification is DISABLED
 * 
 * Supabase Edge Functions can automatically verify JWTs at the platform level
 * before requests reach your code. However, this verification uses legacy JWT
 * validation that may not work with all token formats (especially OAuth tokens).
 * 
 * We've disabled platform-level JWT verification (see config.toml and deno.json)
 * and handle authentication manually using supabase.auth.getUser() instead.
 * 
 * If JWT verification gets re-enabled in the Supabase dashboard, requests will
 * fail with 401 before reaching our code. Solution: Go to Edge Functions settings
 * in Supabase dashboard and ensure "Verify JWT" is toggled OFF for this function.
 */

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Get Supabase admin client for server-side operations
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Get Supabase client for auth operations
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  );
}

// Middleware to verify JWT and extract user ID (using Supabase's getUser method)
async function verifyAuth(c: any, next: any) {
  console.log('📍 verifyAuth middleware called');
  
  const authHeader = c.req.header('Authorization');
  console.log('📍 Authorization header present:', !!authHeader);
  
  if (!authHeader) {
    console.log('❌ No Authorization header');
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('📍 Token extracted (first 20 chars):', token.substring(0, 20));

  try {
    // Use Supabase's built-in getUser method (works with OAuth tokens)
    const supabase = getSupabaseClient();
    
    console.log('📍 Calling supabase.auth.getUser() with token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('❌ Supabase getUser error:', error.message);
      throw error;
    }
    
    if (!user) {
      throw new Error('No user returned from getUser()');
    }

    console.log('✅ User verified successfully:', user.id);
    console.log('✅ User email:', user.email);
    c.set('userId', user.id);
    c.set('userEmail', user.email);
    await next();
  } catch (error: any) {
    console.log('❌ JWT verification failed:', error.message);
    return c.json({ error: 'Unauthorized', details: error.message }, 401);
  }
}

// Middleware to verify editor role
async function verifyEditor(c: any, next: any) {
  const userId = c.get('userId');
  
  try {
    // Query the user_metadata table to get the authoritative role
    const supabase = getSupabaseAdmin();
    const { data: userData, error } = await supabase
      .from('user_metadata')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !userData) {
      console.log('❌ User not found in user_metadata table:', userId);
      return c.json({ error: 'Forbidden - User not found' }, 403);
    }

    const role = userData.role;
    if (role !== 'editor') {
      console.log('❌ User is not an editor. Role from user_metadata table:', role);
      return c.json({ error: 'Forbidden - Editor role required' }, 403);
    }
    
    console.log('✅ Editor role verified from user_metadata table:', role);
    await next();
  } catch (error) {
    console.error('❌ Error in verifyEditor:', error);
    return c.json({ error: 'Failed to verify editor role' }, 500);
  }
}

// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================

// Get Google Maps API key
app.get('/make-server-48182530/config/google-maps-key', (c) => {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return c.json({ error: 'Google Maps API key not configured' }, 500);
  }
  return c.json({ apiKey });
});

// Get all locations (public - no auth required)
app.get('/make-server-48182530/locations', async (c) => {
  console.log('📍 GET /locations - Start');
  try {
    const supabase = getSupabaseAdmin();
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching locations:', error);
      return c.json({ error: 'Failed to fetch locations' }, 500);
    }

    console.log('GET /locations - Found locations:', locations?.length || 0);
    
    // Get favorites count for each location
    const { data: favoriteCounts, error: favCountError } = await supabase
      .from('favorites')
      .select('location_id');
    
    if (favCountError) {
      console.error('❌ Error fetching favorite counts:', favCountError);
    }
    
    // Create a map of location_id to favorites count
    const favCountMap = new Map<string, number>();
    favoriteCounts?.forEach(fav => {
      const count = favCountMap.get(fav.location_id) || 0;
      favCountMap.set(fav.location_id, count + 1);
    });
    
    console.log('📊 Favorites count map:', Object.fromEntries(favCountMap));
    
    // Convert snake_case from DB to camelCase for frontend
    const formattedLocations = locations?.map(loc => ({
      id: loc.id,
      name: loc.name,
      description: loc.description,
      lat: loc.lat,
      lng: loc.lng,
      lvEditorsScore: loc.lv_editors_score,
      lvCrowdsourceScore: loc.lv_crowdsource_score,
      googleRating: loc.google_rating,
      michelinScore: loc.michelin_score,
      tags: loc.tags || [],
      cuisine: loc.cuisine,
      area: loc.area,
      image: loc.image,
      placeId: loc.place_id,
      createdBy: loc.created_by,
      createdAt: loc.created_at,
      updatedBy: loc.updated_by,
      updatedAt: loc.updated_at,
      favoritesCount: favCountMap.get(loc.id) || 0, // Use loc.id (UUID), not place_id
    })) || [];
    
    return c.json({ locations: formattedLocations });
  } catch (error) {
    console.error('❌ Error in GET /locations:', error);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

// Get locations by tag (public - no auth required)
app.get('/make-server-48182530/locations/tag/:tag', async (c) => {
  console.log('📍 GET /locations/tag/:tag - Start');
  const tag = c.req.param('tag');
  console.log('Searching for tag:', tag);
  
  try {
    const supabase = getSupabaseAdmin();
    // Use PostgreSQL array contains operator
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .contains('tags', [tag])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching locations by tag:', error);
      return c.json({ error: 'Failed to fetch locations by tag' }, 500);
    }
    
    console.log('GET /locations/tag - Found locations:', locations?.length || 0);
    
    // Get favorites count for each location
    const { data: favoriteCounts, error: favCountError } = await supabase
      .from('favorites')
      .select('location_id');
    
    if (favCountError) {
      console.error('❌ Error fetching favorite counts:', favCountError);
    }
    
    // Create a map of location_id to favorites count
    const favCountMap = new Map<string, number>();
    favoriteCounts?.forEach(fav => {
      const count = favCountMap.get(fav.location_id) || 0;
      favCountMap.set(fav.location_id, count + 1);
    });
    
    // Convert snake_case to camelCase
    const formattedLocations = locations?.map(loc => ({
      id: loc.id,
      name: loc.name,
      description: loc.description,
      lat: loc.lat,
      lng: loc.lng,
      lvEditorsScore: loc.lv_editors_score,
      lvCrowdsourceScore: loc.lv_crowdsource_score,
      googleRating: loc.google_rating,
      michelinScore: loc.michelin_score,
      tags: loc.tags || [],
      cuisine: loc.cuisine,
      area: loc.area,
      image: loc.image,
      placeId: loc.place_id,
      createdBy: loc.created_by,
      createdAt: loc.created_at,
      updatedBy: loc.updated_by,
      updatedAt: loc.updated_at,
      favoritesCount: favCountMap.get(loc.id) || 0, // Use loc.id (UUID), not place_id
    })) || [];
    
    return c.json({ locations: formattedLocations });
  } catch (error) {
    console.error('❌ Error in GET /locations/tag:', error);
    return c.json({ error: 'Failed to fetch locations by tag' }, 500);
  }
});

// Get all unique tags (public - no auth required)
app.get('/make-server-48182530/tags', async (c) => {
  console.log('📍 GET /tags - Start');
  try {
    const supabase = getSupabaseAdmin();
    const { data: locations, error } = await supabase
      .from('locations')
      .select('tags');

    if (error) {
      console.error('❌ Error fetching tags:', error);
      return c.json({ error: 'Failed to fetch tags' }, 500);
    }

    // Extract unique tags from all locations
    const tagSet = new Set<string>();
    locations?.forEach(loc => {
      if (loc.tags && Array.isArray(loc.tags)) {
        loc.tags.forEach(tag => tagSet.add(tag));
      }
    });

    const uniqueTags = Array.from(tagSet).sort();
    console.log('GET /tags - Found unique tags:', uniqueTags.length);
    return c.json({ tags: uniqueTags });
  } catch (error) {
    console.error('❌ Error in GET /tags:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Get current user info (handles auth internally to bypass platform JWT verification)
app.get('/make-server-48182530/user', async (c) => {
  console.log('📍 GET /user - Start');
  
  // Extract and verify token manually
  const authHeader = c.req.header('Authorization');
  console.log('📍 Authorization header present:', !!authHeader);
  
  if (!authHeader) {
    console.log('❌ No Authorization header');
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('📍 Token extracted (first 20 chars):', token.substring(0, 20));

  try {
    // Use Supabase's built-in getUser method (works with OAuth tokens)
    const supabase = getSupabaseClient();
    
    console.log('📍 Calling supabase.auth.getUser() with token');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.log('❌ Supabase getUser error:', authError.message);
      return c.json({ error: 'Unauthorized', details: authError.message }, 401);
    }
    
    if (!user) {
      return c.json({ error: 'No user returned from getUser()' }, 401);
    }

    console.log('✅ User verified successfully:', user.id);
    console.log('✅ User email:', user.email);
    
    const userId = user.id;
    const userEmail = user.email;
    console.log('📍 User ID from context:', userId);

    // Query the user_metadata table
    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error } = await supabaseAdmin
      .from('user_metadata')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching user from user_metadata table:', error);
      // If user doesn't exist in table, return default user data
      return c.json({ 
        user: {
          id: userId,
          email: userEmail,
          role: 'user',
          name: userEmail?.split('@')[0] || 'User',
        }
      });
    }

    // Map database columns to our API response format
    const userProfile = {
      id: userData.user_id,
      email: userData.email,
      role: userData.role,
      name: userData.name,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    };
    
    console.log('✅ User loaded from user_metadata table:', userProfile);
    return c.json({ user: userProfile });
  } catch (error: any) {
    console.error('❌ Error in GET /user:', error);
    return c.json({ error: 'Failed to fetch user data', details: error.message }, 500);
  }
});

// Update user profile
app.put('/make-server-48182530/user', verifyAuth, async (c) => {
  console.log('📍 PUT /user - Start');
  const userId = c.get('userId');
  const updates = await c.req.json();

  try {
    const supabase = getSupabaseAdmin();
    
    // Prepare updates (convert camelCase to snake_case)
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.email) dbUpdates.email = updates.email;
    
    const { data: updatedUser, error } = await supabase
      .from('user_metadata')
      .update(dbUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating user:', error);
      return c.json({ error: 'Failed to update user' }, 500);
    }

    console.log('✅ User updated:', userId);
    
    // Convert to camelCase for response
    return c.json({
      id: updatedUser.user_id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
    });
  } catch (error) {
    console.error('❌ Error in PUT /user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Get user's favorites
app.get('/make-server-48182530/favorites', verifyAuth, async (c) => {
  console.log('📍 GET /favorites - Start');
  const userId = c.get('userId');

  try {
    const supabase = getSupabaseAdmin();
    
    // Join favorites with locations table
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        id,
        created_at,
        locations (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching favorites:', error);
      return c.json({ error: 'Failed to fetch favorites' }, 500);
    }

    console.log('GET /favorites - Found favorites:', favorites?.length || 0);
    
    // Extract and format location data
    const formattedFavorites = favorites?.map(fav => {
      const loc = fav.locations as any;
      return {
        id: loc.id,
        name: loc.name,
        description: loc.description,
        lat: loc.lat,
        lng: loc.lng,
        lvEditorsScore: loc.lv_editors_score,
        lvCrowdsourceScore: loc.lv_crowdsource_score,
        googleRating: loc.google_rating,
        michelinScore: loc.michelin_score,
        tags: loc.tags || [],
        cuisine: loc.cuisine,
        area: loc.area,
        image: loc.image,
        placeId: loc.place_id,
        createdBy: loc.created_by,
        createdAt: loc.created_at,
        updatedBy: loc.updated_by,
        updatedAt: loc.updated_at,
      };
    }) || [];
    
    return c.json({ favorites: formattedFavorites });
  } catch (error) {
    console.error('❌ Error in GET /favorites:', error);
    return c.json({ error: 'Failed to fetch favorites' }, 500);
  }
});

// Add a favorite
app.post('/make-server-48182530/favorites/:locationId', verifyAuth, async (c) => {
  console.log('📍 POST /favorites/:locationId - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('locationId'); // This can be a place_id or UUID

  if (!locationId) {
    return c.json({ error: 'locationId is required' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Parse body to get optional place data
    let placeData;
    try {
      placeData = await c.req.json();
    } catch (e) {
      placeData = null;
    }
    
    // First, try to find the location by place_id (Google Place ID)
    let { data: location, error: locError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('place_id', locationId)
      .single();

    // If not found by place_id, try by UUID (for LV locations)
    if (locError || !location) {
      const { data: lvLoc, error: lvError } = await supabase
        .from('locations')
        .select('id, name, place_id')
        .eq('id', locationId)
        .single();

      if (!lvError && lvLoc) {
        location = lvLoc;
        console.log('✅ Found location by UUID:', location.id);
        
        // If this location doesn't have a place_id yet, and we have one in placeData, update it
        if (!location.place_id && placeData?.place_id) {
          console.log('💾 Updating location with place_id:', placeData.place_id);
          const { error: updateError } = await supabase
            .from('locations')
            .update({ place_id: placeData.place_id })
            .eq('id', location.id);
            
          if (updateError) {
            console.error('⚠️ Failed to update place_id:', updateError);
          } else {
            console.log('✅ place_id saved to location');
          }
        }
      }
    }

    // If location still doesn't exist and we have place data, create it
    if (locError || !location) {
      if (placeData && placeData.name && placeData.lat && placeData.lng) {
        console.log('📍 Creating new location for favoriting:', placeData.name);
        
        const { data: newLocation, error: createError } = await supabase
          .from('locations')
          .insert({
            name: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng,
            description: placeData.formatted_address || '',
            place_id: placeData.place_id || locationId, // Save place_id from placeData or use locationId
            // Leave ratings null - only editors can rate
            lv_editors_score: null,
            lv_crowdsource_score: null,
            tags: []
          })
          .select('id, name')
          .single();

        if (createError) {
          console.error('❌ Error creating location:', createError);
          return c.json({ error: 'Failed to create location for favoriting' }, 500);
        }

        location = newLocation;
        console.log('✅ Location created:', newLocation.id);
      } else {
        console.error('❌ Location not found and no place data provided');
        return c.json({ 
          error: 'Location not found and insufficient data to create it',
        }, 404);
      }
    }

    // Insert favorite using the UUID
    const { error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        location_id: location.id, // Use the UUID
      });

    if (error) {
      // Check if it's a duplicate key error
      if (error.code === '23505') {
        console.log('📍 Location already favorited');
        return c.json({ success: true, message: 'Already favorited' });
      }
      console.error('❌ Error adding favorite:', error);
      return c.json({ error: 'Failed to add favorite', details: error.message }, 500);
    }

    console.log('✅ Favorite added:', location.id);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in POST /favorites:', error);
    return c.json({ error: 'Failed to add favorite' }, 500);
  }
});

// Remove a favorite
app.delete('/make-server-48182530/favorites/:locationId', verifyAuth, async (c) => {
  console.log('📍 DELETE /favorites/:locationId - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('locationId');

  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('location_id', locationId);

    if (error) {
      console.error('❌ Error removing favorite:', error);
      return c.json({ error: 'Failed to remove favorite' }, 500);
    }

    console.log('✅ Favorite removed:', locationId);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in DELETE /favorites:', error);
    return c.json({ error: 'Failed to remove favorite' }, 500);
  }
});

// Get city favorites stats (public endpoint - aggregate data only)
app.post('/make-server-48182530/favorites/city-stats', async (c) => {
  console.log('📊 POST /favorites/city-stats - Start');
  
  try {
    const { locationIds } = await c.req.json();
    
    if (!locationIds || !Array.isArray(locationIds)) {
      return c.json({ error: 'Invalid locationIds array' }, 400);
    }

    const supabase = getSupabaseAdmin();
    
    // Count total favorites for all locations in this city
    const { count, error } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .in('location_id', locationIds);

    if (error) {
      console.error('❌ Error fetching city favorites:', error);
      return c.json({ error: 'Failed to fetch city favorites' }, 500);
    }

    console.log('✅ City favorites count:', count);
    return c.json({ totalFavorites: count || 0 });
  } catch (error) {
    console.error('❌ Error in POST /favorites/city-stats:', error);
    return c.json({ error: 'Failed to fetch city favorites' }, 500);
  }
});

// ============================================
// WANT TO GO ROUTES
// ============================================

// Get user's want to go list
app.get('/make-server-48182530/want-to-go', verifyAuth, async (c) => {
  console.log('📍 GET /want-to-go - Start');
  const userId = c.get('userId');

  try {
    const supabase = getSupabaseAdmin();
    
    // Join want_to_go with locations table
    const { data: wantToGo, error } = await supabase
      .from('want_to_go')
      .select(`
        id,
        created_at,
        locations (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching want to go:', error);
      return c.json({ error: 'Failed to fetch want to go list' }, 500);
    }

    console.log('GET /want-to-go - Found items:', wantToGo?.length || 0);
    
    // Extract and format location data
    const formattedWantToGo = wantToGo?.map(wtg => {
      const loc = wtg.locations as any;
      return {
        id: loc.id,
        name: loc.name,
        description: loc.description,
        lat: loc.lat,
        lng: loc.lng,
        lvEditorsScore: loc.lv_editors_score,
        lvCrowdsourceScore: loc.lv_crowdsource_score,
        googleRating: loc.google_rating,
        michelinScore: loc.michelin_score,
        tags: loc.tags || [],
        cuisine: loc.cuisine,
        area: loc.area,
        image: loc.image,
        placeId: loc.place_id,
        createdBy: loc.created_by,
        createdAt: loc.created_at,
        updatedBy: loc.updated_by,
        updatedAt: loc.updated_at,
      };
    }) || [];
    
    return c.json({ wantToGo: formattedWantToGo });
  } catch (error) {
    console.error('❌ Error in GET /want-to-go:', error);
    return c.json({ error: 'Failed to fetch want to go list' }, 500);
  }
});

// Add to want to go list
app.post('/make-server-48182530/want-to-go/:locationId', verifyAuth, async (c) => {
  console.log('📍 POST /want-to-go/:locationId - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('locationId'); // This can be a place_id or UUID

  if (!locationId) {
    return c.json({ error: 'locationId is required' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Parse body to get optional place data
    let placeData;
    try {
      placeData = await c.req.json();
    } catch (e) {
      placeData = null;
    }
    
    // First, try to find the location by place_id (Google Place ID)
    let { data: location, error: locError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('place_id', locationId)
      .single();

    // If not found by place_id, try by UUID (for LV locations)
    if (locError || !location) {
      const { data: lvLoc, error: lvError } = await supabase
        .from('locations')
        .select('id, name, place_id')
        .eq('id', locationId)
        .single();

      if (!lvError && lvLoc) {
        location = lvLoc;
        console.log('✅ Found location by UUID:', location.id);
        
        // If this location doesn't have a place_id yet, and we have one in placeData, update it
        if (!location.place_id && placeData?.place_id) {
          console.log('💾 Updating location with place_id:', placeData.place_id);
          const { error: updateError } = await supabase
            .from('locations')
            .update({ place_id: placeData.place_id })
            .eq('id', location.id);
            
          if (updateError) {
            console.error('⚠️ Failed to update place_id:', updateError);
          } else {
            console.log('✅ place_id saved to location');
          }
        }
      }
    }

    // If location still doesn't exist and we have place data, create it
    if (locError || !location) {
      if (placeData && placeData.name && placeData.lat && placeData.lng) {
        console.log('📍 Creating new location for want to go:', placeData.name);
        
        const { data: newLocation, error: createError } = await supabase
          .from('locations')
          .insert({
            name: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng,
            description: placeData.formatted_address || '',
            place_id: placeData.place_id || locationId, // Save place_id from placeData or use locationId
            // Leave ratings null - only editors can rate
            lv_editors_score: null,
            lv_crowdsource_score: null,
            tags: []
          })
          .select('id, name')
          .single();

        if (createError) {
          console.error('❌ Error creating location:', createError);
          return c.json({ error: 'Failed to create location for want to go' }, 500);
        }

        location = newLocation;
        console.log('✅ Location created:', newLocation.id);
      } else {
        console.error('❌ Location not found and no place data provided');
        return c.json({ 
          error: 'Location not found and insufficient data to create it',
        }, 404);
      }
    }

    // Insert want to go using the UUID
    const { error } = await supabase
      .from('want_to_go')
      .insert({
        user_id: userId,
        location_id: location.id, // Use the UUID
      });

    if (error) {
      // Check if it's a duplicate key error
      if (error.code === '23505') {
        console.log('📍 Want to go already exists');
        return c.json({ success: true, message: 'Already in want to go list' });
      }
      console.error('❌ Error adding to want to go:', error);
      return c.json({ error: 'Failed to add to want to go list', details: error.message }, 500);
    }

    console.log('✅ Want to go added:', location.id);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in POST /want-to-go:', error);
    return c.json({ error: 'Failed to add to want to go list' }, 500);
  }
});

// Remove from want to go list
app.delete('/make-server-48182530/want-to-go/:locationId', verifyAuth, async (c) => {
  console.log('📍 DELETE /want-to-go/:locationId - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('locationId');

  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('want_to_go')
      .delete()
      .eq('user_id', userId)
      .eq('location_id', locationId);

    if (error) {
      console.error('❌ Error removing from want to go:', error);
      return c.json({ error: 'Failed to remove from want to go list' }, 500);
    }

    console.log('✅ Want to go removed:', locationId);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in DELETE /want-to-go:', error);
    return c.json({ error: 'Failed to remove from want to go list' }, 500);
  }
});

// ============================================
// EDITOR-ONLY ROUTES
// ============================================

// Create a new location (editors only)
app.post('/make-server-48182530/locations', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 POST /locations - Start');
  const userId = c.get('userId');
  const location = await c.req.json();

  if (!location.name || location.lat === undefined || location.lng === undefined) {
    return c.json({ error: 'name, lat, and lng are required' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Convert camelCase to snake_case for database
    const dbLocation = {
      name: location.name,
      description: location.description,
      lat: location.lat,
      lng: location.lng,
      lv_editors_score: location.lvEditorsScore || 0,
      lv_crowdsource_score: location.lvCrowdsourceScore || 0,
      google_rating: location.googleRating || 0,
      michelin_score: location.michelinScore || 0,
      tags: location.tags || [],
      cuisine: location.cuisine,
      area: location.area,
      image: location.image,
      place_id: location.placeId,
      created_by: userId,
      updated_by: userId,
    };
    
    const { data: newLocation, error } = await supabase
      .from('locations')
      .insert(dbLocation)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating location:', error);
      return c.json({ error: 'Failed to create location' }, 500);
    }

    console.log('✅ Location created:', newLocation.id);
    
    // Convert to camelCase for response
    return c.json({
      id: newLocation.id,
      name: newLocation.name,
      description: newLocation.description,
      lat: newLocation.lat,
      lng: newLocation.lng,
      lvEditorsScore: newLocation.lv_editors_score,
      lvCrowdsourceScore: newLocation.lv_crowdsource_score,
      googleRating: newLocation.google_rating,
      michelinScore: newLocation.michelin_score,
      tags: newLocation.tags || [],
      cuisine: newLocation.cuisine,
      area: newLocation.area,
      image: newLocation.image,
      placeId: newLocation.place_id,
      createdBy: newLocation.created_by,
      createdAt: newLocation.created_at,
      updatedBy: newLocation.updated_by,
      updatedAt: newLocation.updated_at,
    });
  } catch (error) {
    console.error('❌ Error in POST /locations:', error);
    return c.json({ error: 'Failed to create location' }, 500);
  }
});

// Update a location (editors only)
app.put('/make-server-48182530/locations/:id', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 PUT /locations/:id - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('id');
  const updates = await c.req.json();

  try {
    const supabase = getSupabaseAdmin();
    
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.lat !== undefined) dbUpdates.lat = updates.lat;
    if (updates.lng !== undefined) dbUpdates.lng = updates.lng;
    if (updates.lvEditorsScore !== undefined) dbUpdates.lv_editors_score = updates.lvEditorsScore;
    if (updates.lvCrowdsourceScore !== undefined) dbUpdates.lv_crowdsource_score = updates.lvCrowdsourceScore;
    if (updates.googleRating !== undefined) dbUpdates.google_rating = updates.googleRating;
    if (updates.michelinScore !== undefined) dbUpdates.michelin_score = updates.michelinScore;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.cuisine !== undefined) dbUpdates.cuisine = updates.cuisine;
    if (updates.area !== undefined) dbUpdates.area = updates.area;
    if (updates.image !== undefined) dbUpdates.image = updates.image;
    if (updates.placeId !== undefined) dbUpdates.place_id = updates.placeId;
    
    const { data: updatedLocation, error } = await supabase
      .from('locations')
      .update(dbUpdates)
      .eq('id', locationId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating location:', error);
      return c.json({ error: 'Failed to update location' }, 500);
    }

    console.log('✅ Location updated:', locationId);
    
    // Convert to camelCase for response
    return c.json({
      id: updatedLocation.id,
      name: updatedLocation.name,
      description: updatedLocation.description,
      lat: updatedLocation.lat,
      lng: updatedLocation.lng,
      lvEditorsScore: updatedLocation.lv_editors_score,
      lvCrowdsourceScore: updatedLocation.lv_crowdsource_score,
      googleRating: updatedLocation.google_rating,
      michelinScore: updatedLocation.michelin_score,
      tags: updatedLocation.tags || [],
      cuisine: updatedLocation.cuisine,
      area: updatedLocation.area,
      image: updatedLocation.image,
      placeId: updatedLocation.place_id,
      createdBy: updatedLocation.created_by,
      createdAt: updatedLocation.created_at,
      updatedBy: updatedLocation.updated_by,
      updatedAt: updatedLocation.updated_at,
    });
  } catch (error) {
    console.error('❌ Error in PUT /locations:', error);
    return c.json({ error: 'Failed to update location' }, 500);
  }
});

// Delete a location (editors only)
app.delete('/make-server-48182530/locations/:id', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 DELETE /locations/:id - Start');
  const locationId = c.req.param('id');

  try {
    const supabase = getSupabaseAdmin();
    
    // Foreign keys will cascade delete favorites/want_to_go
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);

    if (error) {
      console.error('❌ Error deleting location:', error);
      return c.json({ error: 'Failed to delete location' }, 500);
    }

    console.log('✅ Location deleted:', locationId);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in DELETE /locations:', error);
    return c.json({ error: 'Failed to delete location' }, 500);
  }
});

// Update location rating and tags (editors only)
app.put('/make-server-48182530/locations/:id/rating', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 PUT /locations/:id/rating - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('id');
  const { lvEditorsScore, tags, placeData } = await c.req.json();

  if (lvEditorsScore !== undefined && (lvEditorsScore < 0 || lvEditorsScore > 11)) {
    return c.json({ error: 'lvEditorsScore must be between 0.0 and 11.0' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Check if locationId is a UUID or a Google Place ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(locationId);
    
    let query = supabase.from('locations').select('*');
    
    if (isUUID) {
      // It's a UUID, query by id
      query = query.eq('id', locationId);
    } else {
      // It's a Google Place ID, query by place_id
      query = query.eq('place_id', locationId);
    }
    
    const { data: existingLocation, error: fetchError } = await query.single();
    
    // If location doesn't exist, create it automatically
    if (fetchError || !existingLocation) {
      console.log('📍 Location not found, creating new location:', locationId);
      
      // Validate that we have the necessary place data to create the location
      if (!placeData || !placeData.name || !placeData.lat || !placeData.lng) {
        console.error('❌ Missing place data for creating location:', placeData);
        return c.json({ 
          error: 'Location not found and insufficient data provided to create it. Please provide placeData with name, lat, and lng.' 
        }, 400);
      }
      
      // Create the location
      const newLocation = {
        place_id: locationId,
        name: placeData.name,
        description: placeData.formatted_address || null,
        lat: placeData.lat,
        lng: placeData.lng,
        google_rating: placeData.rating || null,
        lv_editors_score: lvEditorsScore,
        tags: tags || [],
        created_by: userId,
        updated_by: userId,
      };
      
      const { data: createdLocation, error: createError } = await supabase
        .from('locations')
        .insert(newLocation)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating location:', createError);
        return c.json({ error: 'Failed to create location' }, 500);
      }
      
      console.log('✅ Location created and rating added:', createdLocation.id);
      
      return c.json({
        id: createdLocation.id,
        name: createdLocation.name,
        description: createdLocation.description,
        lat: createdLocation.lat,
        lng: createdLocation.lng,
        lvEditorsScore: createdLocation.lv_editors_score,
        lvCrowdsourceScore: createdLocation.lv_crowdsource_score,
        googleRating: createdLocation.google_rating,
        michelinScore: createdLocation.michelin_score,
        tags: createdLocation.tags || [],
        cuisine: createdLocation.cuisine,
        area: createdLocation.area,
        image: createdLocation.image,
        placeId: createdLocation.place_id,
        createdBy: createdLocation.created_by,
        createdAt: createdLocation.created_at,
        updatedBy: createdLocation.updated_by,
        updatedAt: createdLocation.updated_at,
      });
    }
    
    // Location exists, update it
    const dbUpdates: any = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    
    if (lvEditorsScore !== undefined) dbUpdates.lv_editors_score = lvEditorsScore;
    if (tags !== undefined) dbUpdates.tags = tags;
    
    const { data: updatedLocation, error } = await supabase
      .from('locations')
      .update(dbUpdates)
      .eq('id', existingLocation.id) // Always use the UUID for the update
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating location rating/tags:', error);
      return c.json({ error: 'Failed to update location rating/tags' }, 500);
    }

    console.log('✅ Location rating/tags updated:', existingLocation.id);
    
    // Convert to camelCase for response
    return c.json({
      id: updatedLocation.id,
      name: updatedLocation.name,
      description: updatedLocation.description,
      lat: updatedLocation.lat,
      lng: updatedLocation.lng,
      lvEditorsScore: updatedLocation.lv_editors_score,
      lvCrowdsourceScore: updatedLocation.lv_crowdsource_score,
      googleRating: updatedLocation.google_rating,
      michelinScore: updatedLocation.michelin_score,
      tags: updatedLocation.tags || [],
      cuisine: updatedLocation.cuisine,
      area: updatedLocation.area,
      image: updatedLocation.image,
      placeId: updatedLocation.place_id,
      createdBy: updatedLocation.created_by,
      createdAt: updatedLocation.created_at,
      updatedBy: updatedLocation.updated_by,
      updatedAt: updatedLocation.updated_at,
    });
  } catch (error) {
    console.error('❌ Error in PUT /locations/:id/rating:', error);
    return c.json({ error: 'Failed to update location rating/tags' }, 500);
  }
});

// ============================================
// MICHELIN DATA ROUTES
// ============================================

// Sync Michelin data (editor-only for manual sync, or can be public for automation)
app.post('/make-server-48182530/michelin/sync', verifyAuth, verifyEditor, async (c) => {
  console.log('🍽️ POST /michelin/sync - Start');
  
  try {
    const result = await syncMichelinData();
    
    console.log('📊 Michelin sync result:', result);
    
    if (result.success) {
      console.log(`✅ Michelin sync completed: ${result.message}`);
      return c.json({
        success: true,
        added: result.count,
        updated: 0,
        errors: 0,
        message: result.message
      });
    } else {
      console.error(`❌ Michelin sync failed: ${result.message}`);
      return c.json({
        success: false,
        added: 0,
        updated: 0,
        errors: 1,
        message: result.message
      }, 400);
    }
  } catch (error) {
    console.error('❌ Error in POST /michelin/sync:', error);
    return c.json({ 
      success: false, 
      added: 0,
      updated: 0,
      errors: 1,
      message: `Error: ${error instanceof Error ? error.message : String(error)}` 
    }, 500);
  }
});

// Get Michelin rating for a specific location (public endpoint)
app.get('/make-server-48182530/michelin/rating', async (c) => {
  console.log('📍 GET /michelin/rating - Start');
  
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const name = c.req.query('name');
  
  if (!lat || !lng) {
    return c.json({ error: 'lat and lng query parameters are required' }, 400);
  }
  
  try {
    const michelinRating = await getMichelinRating(lat, lng, name);
    
    return c.json({ 
      michelinScore: michelinRating,
      hasMichelinRating: michelinRating !== null && michelinRating > 0,
    });
  } catch (error) {
    console.error('❌ Error in GET /michelin/rating:', error);
    return c.json({ error: 'Failed to get Michelin rating' }, 500);
  }
});

// ============================================
// AUTH ROUTES
// ============================================

// Sign up
app.post('/make-server-48182530/signup', async (c) => {
  console.log('📍 POST /signup - Start');
  const { email, password, name } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || email.split('@')[0] },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('❌ Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    // Create user profile in user_metadata table
    const { error: insertError } = await supabase
      .from('user_metadata')
      .insert({
        user_id: data.user.id,
        email: data.user.email,
        name: name || email.split('@')[0],
        role: 'user',
      });

    if (insertError) {
      console.error('❌ Error creating user profile:', insertError);
      // If profile creation fails, we should probably delete the auth user
      // But for now, just log it
    }

    console.log('✅ User created:', data.user.id);
    
    return c.json({ 
      user: {
        id: data.user.id,
        email: data.user.email,
        name: name || email.split('@')[0],
        role: 'user',
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /signup:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Create OAuth user (called after OAuth sign-in)
app.post('/make-server-48182530/create-oauth-user', verifyAuth, async (c) => {
  console.log('📍 POST /create-oauth-user - Start');
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const { name, role } = await c.req.json();

  try {
    const supabase = getSupabaseAdmin();
    
    // Check if user already exists
    const { data: existingUser, error: selectError } = await supabase
      .from('user_metadata')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingUser) {
      console.log('User already exists:', userId);
      return c.json({ 
        user: {
          id: existingUser.user_id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          createdAt: existingUser.created_at,
          updatedAt: existingUser.updated_at,
        }
      });
    }

    // Create new user profile
    const { error: insertError } = await supabase
      .from('user_metadata')
      .insert({
        user_id: userId,
        email: userEmail,
        name: name || userEmail?.split('@')[0] || 'User',
        role: role || 'user',
      });

    if (insertError) {
      console.error('❌ Error creating OAuth user profile:', insertError);
      return c.json({ error: 'Failed to create user profile' }, 500);
    }

    console.log('✅ OAuth user created:', userId);
    
    return c.json({ 
      user: {
        id: userId,
        email: userEmail,
        name: name || userEmail?.split('@')[0] || 'User',
        role: role || 'user',
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /create-oauth-user:', error);
    return c.json({ error: 'Failed to create OAuth user' }, 500);
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all users (admin/editors)
app.get('/make-server-48182530/admin/users', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 GET /admin/users - Start');

  try {
    const supabase = getSupabaseAdmin();
    
    const { data: users, error } = await supabase
      .from('user_metadata')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users:', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    console.log('GET /admin/users - Found users:', users?.length || 0);
    
    // Convert to camelCase
    const formattedUsers = users?.map(u => ({
      id: u.user_id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    })) || [];
    
    return c.json({ users: formattedUsers });
  } catch (error) {
    console.error('❌ Error in GET /admin/users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Update user role by admin
app.put('/make-server-48182530/admin/users/:userId/role', verifyAuth, async (c) => {
  console.log('📍 PUT /admin/users/:userId/role - Start');
  const targetUserId = c.req.param('userId');
  const { role } = await c.req.json();

  if (!role || !['user', 'editor'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be "user" or "editor"' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Update user role
    const { data: updatedUser, error } = await supabase
      .from('user_metadata')
      .update({ 
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', targetUserId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating user role:', error);
      return c.json({ error: 'Failed to update user role' }, 500);
    }

    console.log('✅ User role updated:', targetUserId, 'to', role);
    
    return c.json({ 
      user: {
        id: updatedUser.user_id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
      }
    });
  } catch (error) {
    console.error('❌ Error in PUT /admin/users/:userId/role:', error);
    return c.json({ error: 'Failed to update user role' }, 500);
  }
});

// Seed database with sample data
app.post('/make-server-48182530/seed', async (c) => {
  console.log('📍 POST /seed - Start');
  
  try {
    const supabase = getSupabaseAdmin();
    
    const sampleLocations = [
      {
        name: "Addison",
        lat: 32.9530,
        lng: -117.2394,
        lv_editors_score: 9.5,
        lv_crowdsource_score: 9.2,
        google_rating: 4.8,
        michelin_score: 0,
        tags: ["fine dining", "french", "del mar"],
        description: "Refined California-French cuisine in an elegant setting",
      },
      {
        name: "Animae",
        lat: 32.7142,
        lng: -117.1625,
        lv_editors_score: 8.8,
        lv_crowdsource_score: 8.5,
        google_rating: 4.6,
        michelin_score: 0,
        tags: ["asian fusion", "cocktails", "downtown"],
        description: "Modern Asian fusion with creative cocktails",
      },
      {
        name: "Born & Raised",
        lat: 32.7165,
        lng: -117.1611,
        lv_editors_score: 9.0,
        lv_crowdsource_score: 8.8,
        google_rating: 4.7,
        michelin_score: 0,
        tags: ["steakhouse", "rooftop", "little italy"],
        description: "Classic steakhouse with stunning rooftop views",
      },
    ];

    const { data: locations, error } = await supabase
      .from('locations')
      .insert(sampleLocations)
      .select();

    if (error) {
      console.error('❌ Error seeding database:', error);
      return c.json({ error: 'Failed to seed database' }, 500);
    }

    console.log('✅ Database seeded with', locations?.length || 0, 'locations');
    return c.json({ success: true, locations });
  } catch (error) {
    console.error('❌ Error in POST /seed:', error);
    return c.json({ error: 'Failed to seed database' }, 500);
  }
});

// Catch-all for unmatched routes
app.all('*', (c) => {
  console.log('❌ 404 - Route not found:', c.req.url);
  return c.json({ error: 'Not Found' }, 404);
});

// Start the server
console.log('🚀 Server starting...');
Deno.serve({
  onListen: () => console.log('✅ Server is listening'),
}, app.fetch);