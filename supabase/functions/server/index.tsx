import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to create Supabase client
const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
};

// Helper function to verify user authentication
const verifyAuth = async (request: Request) => {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return null;
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return null;
  }
  
  return user;
};

// Health check endpoint
app.get("/make-server-48182530/health", (c) => {
  return c.json({ status: "ok" });
});

// Get Google Maps API key
app.get("/make-server-48182530/config/google-maps-key", (c) => {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return c.json({ error: 'Google Maps API key not configured' }, 500);
  }
  return c.json({ apiKey });
});

// Sign up endpoint
app.post("/make-server-48182530/signup", async (c) => {
  const { email, password, name } = await c.req.json();
  
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    // Automatically confirm the user's email since an email server hasn't been configured.
    email_confirm: true
  });
  
  if (error) {
    return c.json({ error: error.message }, 400);
  }
  
  // Store user data in KV store
  await kv.set(`user:${data.user.id}`, {
    id: data.user.id,
    email,
    name,
    role: 'user', // Default role
  });
  
  return c.json({ user: data.user });
});

// Create OAuth user endpoint (called when user logs in via OAuth for the first time)
app.post("/make-server-48182530/create-oauth-user", async (c) => {
  const userData = await c.req.json();
  
  console.log('Creating OAuth user:', userData);
  
  // Check if this is the FIRST user ever created - make them an editor automatically
  const allUsers = await kv.getByPrefix('user:');
  const isFirstUser = allUsers.length === 0;
  
  const role = isFirstUser ? 'editor' : (userData.role || 'user');
  
  if (isFirstUser) {
    console.log('🎉 First user detected! Automatically granting editor role.');
  }
  
  // Store user data in KV store
  await kv.set(`user:${userData.id}`, {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    role: role,
  });
  
  console.log(`OAuth user created successfully with role: ${role}`);
  
  return c.json({ success: true, user: { ...userData, role } });
});

// Get current user endpoint
app.get("/make-server-48182530/user", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const userData = await kv.get(`user:${authUser.id}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  return c.json({ user: userData });
});

// Admin: Get all users
app.get("/make-server-48182530/admin/users", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Check if user is an editor (only editors can access admin panel)
  const currentUser = await kv.get(`user:${authUser.id}`);
  
  if (!currentUser || currentUser.role !== 'editor') {
    return c.json({ error: 'Forbidden: Only editors can access this endpoint' }, 403);
  }
  
  // Get all users
  const allUsers = await kv.getByPrefix('user:');
  
  return c.json({ users: allUsers });
});

// Admin: Update user role
app.put("/make-server-48182530/admin/users/:userId/role", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const userId = c.req.param('userId');
  const { role } = await c.req.json();
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Check if user is an editor (only editors can modify roles)
  const currentUser = await kv.get(`user:${authUser.id}`);
  
  if (!currentUser || currentUser.role !== 'editor') {
    return c.json({ error: 'Forbidden: Only editors can modify user roles' }, 403);
  }
  
  // Get target user and update role
  const targetUser = await kv.get(`user:${userId}`);
  
  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const updatedUser = {
    ...targetUser,
    role,
  };
  
  await kv.set(`user:${userId}`, updatedUser);
  
  return c.json({ user: updatedUser });
});

// Get all locations
app.get("/make-server-48182530/locations", async (c) => {
  const locations = await kv.getByPrefix('location:');
  console.log('GET /locations - Found locations:', locations);
  console.log('Location count:', locations.length);
  if (locations.length > 0) {
    console.log('First location:', JSON.stringify(locations[0], null, 2));
  }
  return c.json({ locations });
});

// Get locations by tag (for heat map)
app.get("/make-server-48182530/locations/tag/:tag", async (c) => {
  const tag = c.req.param('tag');
  const allLocations = await kv.getByPrefix('location:');
  
  const filteredLocations = allLocations.filter((loc: any) => 
    loc.tags && loc.tags.includes(tag.toLowerCase())
  );
  
  return c.json({ locations: filteredLocations });
});

// Add location (editor only)
app.post("/make-server-48182530/locations", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized - Please log in' }, 401);
  }
  
  const userData = await kv.get(`user:${user.id}`);
  
  if (!userData || userData.role !== 'editor') {
    return c.json({ error: 'Forbidden - Editor access required' }, 403);
  }
  
  const locationData = await c.req.json();
  const locationId = crypto.randomUUID();
  
  // Sanitize place_id - ensure it's either a valid string or null
  let placeId = locationData.place_id;
  if (placeId === 'undefined' || placeId === 'null' || placeId === '' || !placeId) {
    placeId = null;
  } else if (typeof placeId === 'string') {
    placeId = placeId.trim();
  }
  
  console.log('=== Adding Location ===');
  console.log('Name:', locationData.name);
  console.log('Original place_id:', locationData.place_id);
  console.log('Sanitized place_id:', placeId);
  
  const location = {
    id: locationId,
    ...locationData,
    place_id: placeId, // Use sanitized place_id
    createdBy: user.id,
    createdAt: new Date().toISOString(),
  };
  
  await kv.set(`location:${locationId}`, location);
  
  console.log('Location saved successfully with place_id:', location.place_id);
  
  return c.json({ location });
});

// Update location (editor only)
app.put("/make-server-48182530/locations/:id", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized - Please log in' }, 401);
  }
  
  const userData = await kv.get(`user:${user.id}`);
  
  if (!userData || userData.role !== 'editor') {
    return c.json({ error: 'Forbidden - Editor access required' }, 403);
  }
  
  const locationId = c.req.param('id');
  const existingLocation = await kv.get(`location:${locationId}`);
  
  if (!existingLocation) {
    return c.json({ error: 'Location not found' }, 404);
  }
  
  const updates = await c.req.json();
  const updatedLocation = {
    ...existingLocation,
    ...updates,
    id: locationId,
    updatedBy: user.id,
    updatedAt: new Date().toISOString(),
  };
  
  await kv.set(`location:${locationId}`, updatedLocation);
  
  return c.json({ location: updatedLocation });
});

// Delete location (editor only)
app.delete("/make-server-48182530/locations/:id", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized - Please log in' }, 401);
  }
  
  const userData = await kv.get(`user:${user.id}`);
  
  if (!userData || userData.role !== 'editor') {
    return c.json({ error: 'Forbidden - Editor access required' }, 403);
  }
  
  const locationId = c.req.param('id');
  await kv.del(`location:${locationId}`);
  
  return c.json({ success: true });
});

// Get city guides
app.get("/make-server-48182530/guides/:cityId", async (c) => {
  const cityId = c.req.param('cityId');
  const guide = await kv.get(`guide:${cityId}`);
  
  if (!guide) {
    return c.json({ error: 'Guide not found' }, 404);
  }
  
  return c.json({ guide });
});

// Favorites endpoints
app.get("/make-server-48182530/favorites", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const favoriteIds = await kv.get(`favorites:${user.id}`) || [];
  const favorites = await kv.mget(favoriteIds.map((id: string) => `location:${id}`));
  
  return c.json({ favorites: favorites.filter(Boolean) });
});

app.post("/make-server-48182530/favorites/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const favoriteIds = await kv.get(`favorites:${user.id}`) || [];
  if (!favoriteIds.includes(locationId)) {
    favoriteIds.push(locationId);
    await kv.set(`favorites:${user.id}`, favoriteIds);
  }
  
  return c.json({ success: true });
});

app.delete("/make-server-48182530/favorites/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const favoriteIds = await kv.get(`favorites:${user.id}`) || [];
  const updatedFavorites = favoriteIds.filter((id: string) => id !== locationId);
  await kv.set(`favorites:${user.id}`, updatedFavorites);
  
  return c.json({ success: true });
});

// Ratings endpoints
app.get("/make-server-48182530/ratings/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ rating: null });
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return c.json({ rating: null });
  }
  
  const rating = await kv.get(`rating:${user.id}:${locationId}`);
  return c.json({ rating: rating || null });
});

app.post("/make-server-48182530/ratings/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  const { rating } = await c.req.json();
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Store user's rating
  await kv.set(`rating:${user.id}:${locationId}`, rating);
  
  // Update location's crowdsource score
  const location = await kv.get(`location:${locationId}`);
  if (location) {
    // Get all ratings for this location
    const allRatings = await kv.getByPrefix(`rating:`);
    const locationRatings = allRatings
      .map((r: any) => r)
      .filter((r: any) => typeof r === 'number'); // Only count actual ratings for this location
    
    // Calculate average (simplified - in production you'd want a better tracking system)
    if (locationRatings.length > 0) {
      const avg = locationRatings.reduce((sum: number, r: number) => sum + r, 0) / locationRatings.length;
      location.lvCrowdsourceScore = avg;
      await kv.set(`location:${locationId}`, location);
    }
  }
  
  return c.json({ success: true, rating });
});

app.get("/make-server-48182530/ratings/:locationId/count", async (c) => {
  const locationId = c.req.param('locationId');
  
  // Get all ratings that match this location pattern
  const allRatings = await kv.getByPrefix(`rating:`);
  const locationRatings = allRatings.filter((key: string) => 
    key.endsWith(`:${locationId}`)
  );
  
  return c.json({ count: locationRatings.length });
});

// Google Places API endpoint
app.get("/make-server-48182530/google/place/:placeId", async (c) => {
  const placeId = c.req.param('placeId');
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  
  console.log('Fetching Google place details for place_id:', placeId);
  
  if (!placeId || placeId === 'undefined' || placeId === 'null') {
    console.error('Invalid place_id:', placeId);
    return c.json({ error: 'Invalid place_id parameter' }, 400);
  }
  
  if (!apiKey) {
    console.error('Google Maps API key not configured');
    return c.json({ error: 'Google Maps API key not configured' }, 500);
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total,photos&key=${apiKey}`;
    console.log('Fetching from URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    
    const response = await fetch(url);
    
    const data = await response.json();
    
    console.log('Google Places API response status:', data.status);
    
    if (data.status !== 'OK') {
      console.error('Google Places API error:', data.status, data.error_message);
      // Return empty data instead of error to prevent InfoWindow from breaking
      return c.json({
        details: {
          rating: null,
          user_ratings_total: null,
          photos: [],
        },
      });
    }
    
    // Transform photos to just include photo_reference
    const photos = data.result?.photos?.map((photo: any) => ({
      photoReference: photo.photo_reference,
      width: photo.width,
      height: photo.height,
    })) || [];
    
    console.log('Successfully fetched place details. Photos count:', photos.length);
    
    return c.json({
      details: {
        rating: data.result?.rating || null,
        user_ratings_total: data.result?.user_ratings_total || null,
        photos,
      },
    });
  } catch (error) {
    console.error('Error fetching Google place details:', error);
    // Return empty data instead of error to prevent InfoWindow from breaking
    return c.json({
      details: {
        rating: null,
        user_ratings_total: null,
        photos: [],
      },
    });
  }
});

// Seed database with sample data (for development)
app.post("/make-server-48182530/seed", async (c) => {
  console.log('Seeding database with sample locations...');
  
  const sampleLocations = [
    {
      id: crypto.randomUUID(),
      name: "Tacos El Gordo",
      lat: 32.7157,
      lng: -117.1611,
      lvEditorsScore: 9.5,
      lvCrowdsourceScore: 9.2,
      googleRating: 4.5,
      michelinScore: 0,
      tags: ["tacos", "mexican", "casual"],
      description: "Legendary Tijuana-style tacos in San Diego",
      cuisine: "Mexican",
      area: "Chula Vista",
      place_id: "ChIJexample123",
      image: null,
      createdBy: "system",
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Addison",
      lat: 32.9547,
      lng: -117.2441,
      lvEditorsScore: 10.8,
      lvCrowdsourceScore: 10.5,
      googleRating: 4.8,
      michelinScore: 3,
      tags: ["fine dining", "french", "michelin"],
      description: "San Diego's only three-Michelin-star restaurant",
      cuisine: "French",
      area: "Del Mar",
      place_id: "ChIJexample456",
      image: null,
      createdBy: "system",
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "The Crack Shack",
      lat: 32.7353,
      lng: -117.1490,
      lvEditorsScore: 8.7,
      lvCrowdsourceScore: 8.9,
      googleRating: 4.6,
      michelinScore: 0,
      tags: ["chicken", "casual", "outdoor"],
      description: "Elevated fried chicken and craft beer",
      cuisine: "American",
      area: "Little Italy",
      place_id: "ChIJexample789",
      image: null,
      createdBy: "system",
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Cali Cream",
      lat: 32.7355,
      lng: -117.1494,
      lvEditorsScore: 7.8,
      lvCrowdsourceScore: 8.1,
      googleRating: 4.7,
      michelinScore: 0,
      tags: ["ice cream", "dessert", "casual"],
      description: "Artisan ice cream with unique flavors",
      cuisine: "Dessert",
      area: "Little Italy",
      place_id: "ChIJexample321",
      image: null,
      createdBy: "system",
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Born & Raised",
      lat: 32.7350,
      lng: -117.1498,
      lvEditorsScore: 9.8,
      lvCrowdsourceScore: 9.4,
      googleRating: 4.7,
      michelinScore: 1,
      tags: ["steakhouse", "fine dining", "rooftop"],
      description: "Opulent steakhouse with rooftop bar",
      cuisine: "Steakhouse",
      area: "Little Italy",
      place_id: "ChIJexample654",
      image: null,
      createdBy: "system",
      createdAt: new Date().toISOString(),
    },
  ];
  
  for (const location of sampleLocations) {
    await kv.set(`location:${location.id}`, location);
    console.log(`Seeded location: ${location.name}`);
  }
  
  console.log(`Successfully seeded ${sampleLocations.length} locations`);
  
  return c.json({ 
    success: true, 
    message: `Seeded ${sampleLocations.length} locations`,
    locations: sampleLocations 
  });
});

// Catch-all route for any unmatched paths
app.all('*', (c) => {
  console.log('Unmatched route:', c.req.path);
  console.log('Method:', c.req.method);
  return c.json({ error: 'requested path is invalid' }, 404);
});

Deno.serve(app.fetch);