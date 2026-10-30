import {
  supabase,
  SITE_VIDEO_BUCKET,
  SITE_VIDEO_FOLDER,
  SITE_VIDEO_NAME,
  SITE_VIDEO_PATH
} from "./supabase-client.js";
import { formatDate, renderEmptyRow, createRow } from "./admin-table.js";
import { loadMemberships } from "./admin-memberships.js";
import { loadStayBookings } from "./admin-bookings.js";
import { loadAvailability } from "./admin-availability.js";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const RECENT_UPLOAD_LIMIT = 5;

const message = document.getElementById("adminMessage");
const dashboard = document.getElementById("adminDashboard");
const restricted = document.getElementById("adminRestricted");
const logoutButton = document.getElementById("adminLogout");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("videoFile");
const uploadButton = document.getElementById("uploadButton");
const preview = document.getElementById("videoPreview");
const emptyState = document.getElementById("videoEmpty");
const statMembers = document.getElementById("statMembers");
const statViews = document.getElementById("statViews");
const statUploads = document.getElementById("statUploads");
const uploadsBody = document.getElementById("uploadsBody");

const countFormatter = new Intl.NumberFormat("en-GB");

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("admin__message--error", isError);
}

function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadCount(table) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function loadStats() {
  const [members, views, uploads] = await Promise.all([
    loadCount("memberships"),
    loadCount("video_views"),
    loadCount("video_uploads")
  ]);

  statMembers.textContent = countFormatter.format(members);
  statViews.textContent = countFormatter.format(views);
  statUploads.textContent = countFormatter.format(uploads);
}

async function loadRecentUploads() {
  const { data, error } = await supabase
    .from("video_uploads")
    .select("file_name, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_UPLOAD_LIMIT);

  if (error) throw error;

  if (!data.length) {
    renderEmptyRow(uploadsBody, 3, "No uploads yet.");
    return;
  }

  uploadsBody.replaceChildren(...data.map(upload => createRow([
    upload.file_name,
    formatMegabytes(upload.size_bytes),
    formatDate(upload.created_at)
  ])));
}

async function findCurrentVideo() {
  const { data, error } = await supabase.storage
    .from(SITE_VIDEO_BUCKET)
    .list(SITE_VIDEO_FOLDER, { search: SITE_VIDEO_NAME });

  if (error) throw error;

  return (data || []).find(file => file.name === SITE_VIDEO_NAME) || null;
}

async function showCurrentVideo() {
  const file = await findCurrentVideo();

  if (!file) {
    preview.hidden = true;
    preview.removeAttribute("src");
    emptyState.hidden = false;
    return;
  }

  const { data } = supabase.storage.from(SITE_VIDEO_BUCKET).getPublicUrl(SITE_VIDEO_PATH);
  const version = new Date(file.updated_at || Date.now()).getTime();

  emptyState.hidden = true;
  preview.hidden = false;
  preview.src = `${data.publicUrl}?v=${version}`;
}

async function refreshDashboard() {
  await Promise.all([
    showCurrentVideo(),
    loadStats(),
    loadRecentUploads(),
    loadMemberships(),
    loadStayBookings(),
    loadAvailability()
  ]);
}

preview.addEventListener("error", () => {
  setMessage("The current video could not be previewed, but the homepage may still show it.", true);
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];

  if (!file) {
    setMessage("Choose an MP4 video to upload.", true);
    return;
  }

  const isMp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");

  if (!isMp4) {
    setMessage("Only MP4 videos can be uploaded.", true);
    return;
  }

  if (file.size > MAX_VIDEO_BYTES) {
    setMessage("That video is larger than 50 MB. Please compress it and try again.", true);
    return;
  }

  uploadButton.disabled = true;
  setMessage("Uploading video…");

  try {
    const { error: storageError } = await supabase.storage
      .from(SITE_VIDEO_BUCKET)
      .upload(SITE_VIDEO_PATH, file, {
        upsert: true,
        contentType: "video/mp4",
        cacheControl: "60"
      });

    if (storageError) throw storageError;

    const { error: logError } = await supabase
      .from("video_uploads")
      .insert({ file_name: file.name, size_bytes: file.size });

    if (logError) throw logError;

    uploadForm.reset();
    await refreshDashboard();
    setMessage("Video uploaded. It can take about a minute to appear on the homepage.");
  } catch (error) {
    console.error("Video upload failed:", error);
    setMessage(`Upload failed: ${error.message}`, true);
  } finally {
    uploadButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();

  if (error) {
    setMessage("Couldn't log out. Please try again.", true);
    logoutButton.disabled = false;
    return;
  }

  window.location.replace("../login/");
});

async function init() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.replace("../login/?next=admin");
    return;
  }

  const { data: allowed, error: permissionError } = await supabase.rpc("is_edan_admin");

  if (permissionError || allowed !== true) {
    restricted.hidden = false;
    setMessage("");
    return;
  }

  dashboard.hidden = false;
  setMessage("");
  await refreshDashboard();
}

init().catch(error => {
  console.error("Dashboard error:", error);
  setMessage("Something went wrong loading the dashboard. Refresh and try again.", true);
});
