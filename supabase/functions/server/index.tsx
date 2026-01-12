import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as jose from "jsr:@panva/jose@6"; // Add this import for proper JWT verification

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

// Middleware to verify JWT and extract user ID (updated for proper signature verification with jose)
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
    // Verify JWT signature using JWKS (supports ES256)
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });

    if (!payload.sub) {
      throw new Error('No user ID in payload');
    }

    console.log('✅ User verified successfully:', payload.sub);
    console.log('✅ User email:', payload.email);
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    await next();
  } catch (error: any) {
    console.log('❌ JWT verification failed:', error.message);
    console.log('❌ Full error:', JSON.stringify(error));
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
app.post('/make-server-48182530/favorites', verifyAuth, async (c) => {
  console.log('📍 POST /favorites - Start');
  const userId = c.get('userId');
  const { locationId } = await c.req.json();

  if (!locationId) {
    return c.json({ error: 'locationId is required' }, 400);
  }

  try {
    const favoriteKey = `favorite:${userId}:${locationId}`;
    const favorite = {
      userId,
      locationId,
      createdAt: new Date().toISOString(),
    };
    await kv.set(favoriteKey, favorite);
    console.log('✅ Favorite added:', favoriteKey);
    return c.json(favorite);
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

// Start the server with JWT validation DISABLED
// This allows us to manually verify OAuth JWTs in our middleware
console.log('🚀 Server starting with manual JWT verification');
Deno.serve(app.fetch);