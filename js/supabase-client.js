const SUPABASE_URL = "https://ayjyvuulgqobppyvroyl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qJXFQXVMZnEum0BUqGlR6g_VOCtzkgm";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export const SITE_VIDEO_BUCKET = "site-videos";
export const SITE_VIDEO_FOLDER = "hero";
export const SITE_VIDEO_NAME = "edan-hero.mp4";
export const SITE_VIDEO_PATH = `${SITE_VIDEO_FOLDER}/${SITE_VIDEO_NAME}`;
