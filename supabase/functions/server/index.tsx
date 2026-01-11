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

// Get current user endpoint
app.get("/make-server-48182530/user", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const userData = await kv.get(`user:${user.id}`);
  
  return c.json({ user: userData });
});

// Update user role (only for development/testing - in production this should be secured)
app.post("/make-server-48182530/user/role", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const { role } = await c.req.json();
  
  const userData = await kv.get(`user:${user.id}`);
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const updatedUser = { ...userData, role };
  await kv.set(`user:${user.id}`, updatedUser);
  
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
  
  const location = {
    id: locationId,
    ...locationData,
    createdBy: user.id,
    createdAt: new Date().toISOString(),
  };
  
  await kv.set(`location:${locationId}`, location);
  
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

Deno.serve(app.fetch);