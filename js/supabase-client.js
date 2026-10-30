const SUPABASE_URL = "https://qavarsxjqxogfilpgyxn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdmFyc3hqcXhvZ2ZpbHBneXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDkzMTUsImV4cCI6MjEwODkyNTMxNX0.1tKvqzcirTrYoSsZmxdNykmIzQP_wu_XsjRT1lq8zEs";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export const SITE_VIDEO_BUCKET = "site-videos";
export const SITE_VIDEO_FOLDER = "hero";
export const SITE_VIDEO_NAME = "edan-hero.mp4";
export const SITE_VIDEO_PATH = `${SITE_VIDEO_FOLDER}/${SITE_VIDEO_NAME}`;
