import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

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

// Middleware to verify JWT and extract user ID
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

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  
  console.log('📍 getUser result - has user:', !!data?.user, 'has error:', !!error);
  if (error) {
    console.log('❌ getUser error:', error.message);
  }

  if (error || !data.user) {
    console.log('❌ Authorization error during JWT verification:', error?.message || 'No user found');
    return c.json({ error: 'Unauthorized', details: error?.message }, 401);
  }

  console.log('✅ User verified:', data.user.id);
  c.set('userId', data.user.id);
  c.set('userEmail', data.user.email);
  await next();
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
    return c.json(locations);
  } catch (error) {
    console.error('❌ Error in GET /locations:', error);
    return c.json({ error: 'Failed to fetch locations' }, 500);
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
      return c.json(defaultProfile);
    }

    return c.json(userProfile);
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
    const favorites = await kv.getByPrefix(`favorite:${userId}:`);
    console.log('GET /favorites - Found favorites:', favorites.length);
    return c.json(favorites);
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

// Catch-all for unmatched routes
app.all('*', (c) => {
  console.log('❌ 404 - Route not found:', c.req.url);
  return c.json({ error: 'Not Found' }, 404);
});

// Start the server with JWT validation DISABLED
// This allows us to manually verify OAuth JWTs in our middleware
console.log('🚀 Server starting with manual JWT verification');
Deno.serve(app.fetch);
