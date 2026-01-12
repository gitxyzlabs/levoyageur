import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as jose from "jsr:@panva/jose@6"; // Add this import for proper JWT verification

// Debug logging for environment variables
console.log("SUPABASE_URL from env:", Deno.env.get("SUPABASE_URL"));
console.log("JWKS URL being used:", `${Deno.env.get("SUPABASE_URL")}/auth/v1/.well-known/jwks.json`);

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

// JWKS for JWT verification (fetches public keys for ES256 or other asymmetric algs)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const JWKS = jose.createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

// Middleware to verify JWT and extract user ID (using Supabase's getUser method)
async function verifyAuth(c: any, next: any) {
  console.log('📍 verifyAuth middleware called');
  console.log('📍 Request URL:', c.req.url);
  console.log('📍 Request method:', c.req.method);
  
  const authHeader = c.req.header('Authorization');
  console.log('📍 Authorization header present:', !!authHeader);
  
  if (!authHeader) {
    console.log('❌ No Authorization header');
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('📍 Token extracted (first 20 chars):', token.substring(0, 20));
  console.log('📍 Token length:', token.length);

  try {
    // Use Supabase's built-in getUser method instead of manual JWT verification
    // This should work with OAuth tokens
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    
    console.log('📍 Calling supabase.auth.getUser() with token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('❌ Supabase getUser error:', error.message);
      console.log('❌ Error details:', JSON.stringify(error));
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
    console.log('❌ Error stack:', error.stack);
    
    // Try to decode the JWT without verification to see what's in it
    try {
      const decoded = jose.decodeJwt(token);
      console.log('📍 Decoded JWT payload (unverified):');
      console.log('  - sub:', decoded.sub);
      console.log('  - email:', decoded.email);
      console.log('  - aud:', decoded.aud);
      console.log('  - iss:', decoded.iss);
      console.log('  - exp:', decoded.exp);
      console.log('  - iat:', decoded.iat);
    } catch (decodeError) {
      console.log('❌ Could not decode JWT:', decodeError);
    }
    
    return c.json({ error: 'Unauthorized', details: error.message }, 401);
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
    const locations = await kv.getByPrefix('location:');
    console.log('GET /locations - Found locations:', locations.length);
    // Return in the format expected by the client: { locations: Location[] }
    return c.json({ locations });
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
    const allLocations = await kv.getByPrefix('location:');
    // Filter locations that have this tag (case-insensitive)
    const filteredLocations = allLocations.filter((loc: any) => {
      if (!loc.tags || !Array.isArray(loc.tags)) return false;
      return loc.tags.some((t: string) => 
        t.toLowerCase() === tag.toLowerCase()
      );
    });
    
    console.log('GET /locations/tag - Found locations:', filteredLocations.length);
    return c.json({ locations: filteredLocations });
  } catch (error) {
    console.error('❌ Error in GET /locations/tag:', error);
    return c.json({ error: 'Failed to fetch locations by tag' }, 500);
  }
});

// Get all tags (public - no auth required)
app.get('/make-server-48182530/tags', async (c) => {
  console.log('📍 GET /tags - Start');
  try {
    const tags = await kv.getByPrefix('tag:');
    console.log('GET /tags - Found tags:', tags.length);
    return c.json({ tags: tags.map((tag: any) => tag.name) });
  } catch (error) {
    console.error('❌ Error in GET /tags:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Get current user info
app.get('/make-server-48182530/user', verifyAuth, async (c) => {
  console.log('📍 GET /user - Start');
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  console.log('📍 User ID from context:', userId);

  try {
    // Get user profile from KV store
    const userProfile = await kv.get(`user:${userId}`);
    console.log('📍 User profile from KV:', userProfile);
    
    if (!userProfile) {
      // Create default user profile
      const defaultProfile = {
        id: userId,
        email: userEmail,
        role: 'user',
        name: userEmail?.split('@')[0] || 'User',
        createdAt: new Date().toISOString(),
      };
      console.log('📍 Creating default profile:', defaultProfile);
      await kv.set(`user:${userId}`, defaultProfile);
      return c.json({ user: defaultProfile }); // Wrapped for consistency
    }

    return c.json({ user: userProfile }); // Wrapped for consistency
  } catch (error) {
    console.error('❌ Error in GET /user:', error);
    return c.json({ error: 'Failed to fetch user data' }, 500);
  }
});

// Update user profile
app.put('/make-server-48182530/user', verifyAuth, async (c) => {
  console.log('📍 PUT /user - Start');
  const userId = c.get('userId');
  const updates = await c.req.json();

  try {
    const existingUser = await kv.get(`user:${userId}`);
    const updatedUser = { ...existingUser, ...updates, id: userId };
    await kv.set(`user:${userId}`, updatedUser);
    console.log('✅ User updated:', userId);
    return c.json(updatedUser);
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
    const favoriteRecords = await kv.getByPrefix(`favorite:${userId}:`);
    console.log('GET /favorites - Found favorite records:', favoriteRecords.length);
    
    // Get the actual location data for each favorite
    const favorites = [];
    for (const fav of favoriteRecords) {
      const location = await kv.get(`location:${fav.locationId}`);
      if (location) {
        favorites.push(location);
      }
    }
    
    console.log('GET /favorites - Resolved locations:', favorites.length);
    return c.json({ favorites });
  } catch (error) {
    console.error('❌ Error in GET /favorites:', error);
    return c.json({ error: 'Failed to fetch favorites' }, 500);
  }
});

// Add a favorite
app.post('/make-server-48182530/favorites/:locationId', verifyAuth, async (c) => {
  console.log('📍 POST /favorites/:locationId - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('locationId');

  if (!locationId) {
    return c.json({ error: 'locationId is required' }, 400);
  }

  try {
    // Check if location exists, if not create a minimal record
    // This handles Google Place IDs that aren't in our database yet
    const existingLocation = await kv.get(`location:${locationId}`);
    if (!existingLocation) {
      console.log('📍 Location not found, creating minimal record for:', locationId);
      // Create a minimal location record - it will be enriched by frontend or editor later
      const minimalLocation = {
        id: locationId,
        name: 'Google Place', // Frontend should update this
        lat: 0,
        lng: 0,
        lvEditorsScore: 0,
        lvCrowdsourceScore: 0,
        googleRating: 0,
        michelinScore: 0,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`location:${locationId}`, minimalLocation);
    }

    const favoriteKey = `favorite:${userId}:${locationId}`;
    const favorite = {
      userId,
      locationId,
      createdAt: new Date().toISOString(),
    };
    await kv.set(favoriteKey, favorite);
    console.log('✅ Favorite added:', favoriteKey);
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
    const favoriteKey = `favorite:${userId}:${locationId}`;
    await kv.del(favoriteKey);
    console.log('✅ Favorite removed:', favoriteKey);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in DELETE /favorites:', error);
    return c.json({ error: 'Failed to remove favorite' }, 500);
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
    const wantToGoRecords = await kv.getByPrefix(`wantToGo:${userId}:`);
    console.log('GET /want-to-go - Found records:', wantToGoRecords.length);
    
    // Get the actual location data for each want to go item
    const wantToGo = [];
    for (const wtg of wantToGoRecords) {
      const location = await kv.get(`location:${wtg.locationId}`);
      if (location) {
        wantToGo.push(location);
      }
    }
    
    console.log('GET /want-to-go - Resolved locations:', wantToGo.length);
    return c.json({ wantToGo });
  } catch (error) {
    console.error('❌ Error in GET /want-to-go:', error);
    return c.json({ error: 'Failed to fetch want to go list' }, 500);
  }
});

// Add to want to go list
app.post('/make-server-48182530/want-to-go/:locationId', verifyAuth, async (c) => {
  console.log('📍 POST /want-to-go/:locationId - Start');
  const userId = c.get('userId');
  const locationId = c.req.param('locationId');

  if (!locationId) {
    return c.json({ error: 'locationId is required' }, 400);
  }

  try {
    // Check if location exists, if not create a minimal record
    // This handles Google Place IDs that aren't in our database yet
    const existingLocation = await kv.get(`location:${locationId}`);
    if (!existingLocation) {
      console.log('📍 Location not found, creating minimal record for:', locationId);
      // Create a minimal location record - it will be enriched by frontend or editor later
      const minimalLocation = {
        id: locationId,
        name: 'Google Place', // Frontend should update this
        lat: 0,
        lng: 0,
        lvEditorsScore: 0,
        lvCrowdsourceScore: 0,
        googleRating: 0,
        michelinScore: 0,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`location:${locationId}`, minimalLocation);
    }

    const wantToGoKey = `wantToGo:${userId}:${locationId}`;
    const wantToGoItem = {
      userId,
      locationId,
      createdAt: new Date().toISOString(),
    };
    await kv.set(wantToGoKey, wantToGoItem);
    console.log('✅ Want to go added:', wantToGoKey);
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
    const wantToGoKey = `wantToGo:${userId}:${locationId}`;
    await kv.del(wantToGoKey);
    console.log('✅ Want to go removed:', wantToGoKey);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in DELETE /want-to-go:', error);
    return c.json({ error: 'Failed to remove from want to go list' }, 500);
  }
});

// ============================================
// EDITOR-ONLY ROUTES
// ============================================

// Middleware to verify editor role
async function verifyEditor(c: any, next: any) {
  const userId = c.get('userId');
  
  try {
    const user = await kv.get(`user:${userId}`);
    if (!user || user.role !== 'editor') {
      console.log('❌ User is not an editor:', userId);
      return c.json({ error: 'Forbidden - Editor role required' }, 403);
    }
    await next();
  } catch (error) {
    console.error('❌ Error in verifyEditor:', error);
    return c.json({ error: 'Failed to verify editor role' }, 500);
  }
}

// Create a new location (editors only)
app.post('/make-server-48182530/locations', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 POST /locations - Start');
  const location = await c.req.json();

  if (!location.name || !location.lat || !location.lng) {
    return c.json({ error: 'name, lat, and lng are required' }, 400);
  }

  try {
    const locationId = crypto.randomUUID();
    const newLocation = {
      ...location,
      id: locationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`location:${locationId}`, newLocation);
    console.log('✅ Location created:', locationId);
    return c.json(newLocation);
  } catch (error) {
    console.error('❌ Error in POST /locations:', error);
    return c.json({ error: 'Failed to create location' }, 500);
  }
});

// Update a location (editors only)
app.put('/make-server-48182530/locations/:id', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 PUT /locations/:id - Start');
  const locationId = c.req.param('id');
  const updates = await c.req.json();

  try {
    const existingLocation = await kv.get(`location:${locationId}`);
    if (!existingLocation) {
      return c.json({ error: 'Location not found' }, 404);
    }

    const updatedLocation = {
      ...existingLocation,
      ...updates,
      id: locationId,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`location:${locationId}`, updatedLocation);
    console.log('✅ Location updated:', locationId);
    return c.json(updatedLocation);
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
    await kv.del(`location:${locationId}`);
    console.log('✅ Location deleted:', locationId);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in DELETE /locations:', error);
    return c.json({ error: 'Failed to delete location' }, 500);
  }
});

// Create a new tag (editors only)
app.post('/make-server-48182530/tags', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 POST /tags - Start');
  const { name } = await c.req.json();

  if (!name) {
    return c.json({ error: 'name is required' }, 400);
  }

  try {
    const tagId = crypto.randomUUID();
    const newTag = {
      id: tagId,
      name: name.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
    };
    await kv.set(`tag:${tagId}`, newTag);
    console.log('✅ Tag created:', tagId);
    return c.json(newTag);
  } catch (error) {
    console.error('❌ Error in POST /tags:', error);
    return c.json({ error: 'Failed to create tag' }, 500);
  }
});

// Update location rating and tags (editors only)
app.put('/make-server-48182530/locations/:id/rating', verifyAuth, verifyEditor, async (c) => {
  console.log('📍 PUT /locations/:id/rating - Start');
  const locationId = c.req.param('id');
  const { lvEditorsScore, tags } = await c.req.json();

  if (lvEditorsScore !== undefined && (lvEditorsScore < 0 || lvEditorsScore > 11)) {
    return c.json({ error: 'lvEditorsScore must be between 0.0 and 11.0' }, 400);
  }

  try {
    const existingLocation = await kv.get(`location:${locationId}`);
    if (!existingLocation) {
      return c.json({ error: 'Location not found' }, 404);
    }

    const updatedLocation = {
      ...existingLocation,
      ...(lvEditorsScore !== undefined && { lvEditorsScore }),
      ...(tags !== undefined && { tags }),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`location:${locationId}`, updatedLocation);
    console.log('✅ Location rating/tags updated:', locationId);
    return c.json(updatedLocation);
  } catch (error) {
    console.error('❌ Error in PUT /locations/:id/rating:', error);
    return c.json({ error: 'Failed to update location rating/tags' }, 500);
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

    // Create user profile in KV store
    const userProfile = {
      id: data.user.id,
      email: data.user.email,
      role: 'user',
      name: name || email.split('@')[0],
      createdAt: new Date().toISOString(),
    };
    await kv.set(`user:${data.user.id}`, userProfile);

    console.log('✅ User created:', data.user.id);
    return c.json({ user: userProfile });
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
  const { id, email, name, role } = await c.req.json();

  try {
    // Check if user already exists
    const existingUser = await kv.get(`user:${userId}`);
    if (existingUser) {
      console.log('User already exists:', userId);
      return c.json({ user: existingUser });
    }

    // Create new user profile
    const userProfile = {
      id: userId,
      email: email || userEmail,
      name: name || userEmail?.split('@')[0] || 'User',
      role: role || 'user',
      createdAt: new Date().toISOString(),
    };
    await kv.set(`user:${userId}`, userProfile);

    console.log('✅ OAuth user created:', userId);
    return c.json({ user: userProfile });
  } catch (error) {
    console.error('❌ Error in POST /create-oauth-user:', error);
    return c.json({ error: 'Failed to create OAuth user' }, 500);
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all users (admin/editors)
app.get('/make-server-48182530/admin/users', verifyAuth, async (c) => {
  console.log('📍 GET /admin/users - Start');
  const userId = c.get('userId');

  try {
    // Check if requesting user is an editor (we'll allow editors to see users for now)
    const requestingUser = await kv.get(`user:${userId}`);
    if (!requestingUser || requestingUser.role !== 'editor') {
      return c.json({ error: 'Forbidden - Editor role required' }, 403);
    }

    const users = await kv.getByPrefix('user:');
    console.log('GET /admin/users - Found users:', users.length);
    return c.json({ users });
  } catch (error) {
    console.error('❌ Error in GET /admin/users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Update user role by admin
app.put('/make-server-48182530/admin/users/:userId/role', verifyAuth, async (c) => {
  console.log('📍 PUT /admin/users/:userId/role - Start');
  const requestingUserId = c.get('userId');
  const targetUserId = c.req.param('userId');
  const { role } = await c.req.json();

  if (!role || !['user', 'editor'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be "user" or "editor"' }, 400);
  }

  try {
    // For now, allow any authenticated user to become an editor (as per the "Become Editor" flow)
    // In production, you'd want stricter controls here
    const targetUser = await kv.get(`user:${targetUserId}`);
    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updatedUser = {
      ...targetUser,
      role,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`user:${targetUserId}`, updatedUser);

    console.log('✅ User role updated:', targetUserId, 'to', role);
    return c.json({ user: updatedUser });
  } catch (error) {
    console.error('❌ Error in PUT /admin/users/:userId/role:', error);
    return c.json({ error: 'Failed to update user role' }, 500);
  }
});

// Seed database with sample data
app.post('/make-server-48182530/seed', async (c) => {
  console.log('📍 POST /seed - Start');
  
  try {
    const sampleLocations = [
      {
        id: crypto.randomUUID(),
        name: "Addison",
        lat: 32.9530,
        lng: -117.2394,
        lvEditorsScore: 9.5,
        lvCrowdsourceScore: 9.2,
        googleRating: 4.8,
        michelinScore: 0,
        tags: ["fine dining", "french", "del mar"],
        description: "Refined California-French cuisine in an elegant setting",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Animae",
        lat: 32.7142,
        lng: -117.1625,
        lvEditorsScore: 8.8,
        lvCrowdsourceScore: 8.5,
        googleRating: 4.6,
        michelinScore: 0,
        tags: ["asian fusion", "cocktails", "downtown"],
        description: "Modern Asian fusion with creative cocktails",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Born & Raised",
        lat: 32.7165,
        lng: -117.1611,
        lvEditorsScore: 9.0,
        lvCrowdsourceScore: 8.8,
        googleRating: 4.7,
        michelinScore: 0,
        tags: ["steakhouse", "rooftop", "little italy"],
        description: "Classic steakhouse with stunning rooftop views",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Save each location
    for (const location of sampleLocations) {
      await kv.set(`location:${location.id}`, location);
    }

    console.log('✅ Database seeded with', sampleLocations.length, 'locations');
    return c.json({ success: true, locations: sampleLocations });
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

// Start the server with manual JWT verification (disable Supabase's built-in JWT verification)
console.log('🚀 Server starting with manual JWT verification');
Deno.serve({
  // Disable automatic JWT verification - we handle it manually in our middleware
  onListen: () => console.log('✅ Server is listening'),
}, app.fetch);