// Replace with your actual Supabase Project URL and anon key
const SUPABASE_URL = 'https://oxscpolpirvhtizamrjj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2Nwb2xwaXJ2aHRpemFtcmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzODA4MjYsImV4cCI6MjA3MDk1NjgyNn0.JW4U_ljHHmE7Gb46OIJwjgQ1foCy1H6lfvX3FLxllJU';


let supabaseClient = null;

// Ensure that window.supabase.createClient is available
// The Supabase CDN script typically attaches `createClient` directly to `window.supabase` object
// that it creates. So we wait for it to be ready.
if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    // Fallback if window.supabase is not the expected object
    // This might happen if using an older CDN version or a different module system
    // For `supabase-js@2`, `createClient` is usually directly available on `window` or `supabase` object.
    // If you explicitly included `@supabase/supabase-js` via CDN, `createClient` should be available.
    console.error("Supabase's `createClient` function is not found on `window.supabase`. Check your CDN script.");
    // You could try `createClient` directly if it's placed in the global scope by the CDN
    // For example:
    // if (typeof createClient === 'function') {
    //     supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // }
}


// Make the created client instance globally accessible
// This is the object your other scripts will use (`window.supabase.from(...)`)
window.supabase = supabaseClient;

if (supabaseClient) {
    console.log('Supabase client initialized successfully.');
} else {
    console.error('Failed to initialize Supabase client.');
}