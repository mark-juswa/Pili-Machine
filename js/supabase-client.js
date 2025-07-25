// Replace with your actual Supabase Project URL and anon key
const SUPABASE_URL = 'https://cnlkgbvpppqdbtrbywfo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNubGtnYnZwcHBxZGJ0cmJ5d2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0Mjg0NjksImV4cCI6MjA2OTAwNDQ2OX0._OuHsRxF5K6xMb_FITHpEUjz_RXPqr5YaBG4qyxyn1s';


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