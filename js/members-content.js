/* =========================================
   ƐDAN — MEMBER CONTENT
   Gatherings and annual bonus videos.
   Access is enforced by row level security.
   ========================================= */

(() => {
  "use strict";

  const SUPABASE_URL = "https://qavarsxjqxogfilpgyxn.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdmFyc3hqcXhvZ2ZpbHBneXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDkzMTUsImV4cCI6MjEwODkyNTMxNX0.1tKvqzcirTrYoSsZmxdNykmIzQP_wu_XsjRT1lq8zEs";

  const gatheringList = document.getElementById("gatheringList");
  const gatheringEmpty = document.getElementById("gatheringEmpty");
  const videoList = document.getElementById("bonusVideoList");
  const videoEmpty = document.getElementById("bonusVideoEmpty");

  const dateFormat = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function isWebUrl(value) {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }

  function renderGathering(item) {
    const card = element("article", "members__gathering");
    const copy = element("div", "members__gathering-copy");

    if (item.starts_at) {
      const date = element("time", "members__gathering-date", dateFormat.format(new Date(item.starts_at)));
      date.dateTime = item.starts_at;
      copy.append(date);
    }

    copy.append(element("h3", "", item.title));

    if (item.location) {
      copy.append(element("p", "members__gathering-location", item.location));
    }

    if (item.description) {
      const details = element("details", "members__gathering-details");
      details.append(
        element("summary", "", "View details"),
        element("p", "", item.description)
      );
      copy.append(details);
    }

    if (item.registration_url && isWebUrl(item.registration_url)) {
      const link = element("a", "members__action", "Register ↗");
      link.href = item.registration_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      copy.append(link);
    }

    if (item.image_path) {
      const image = element("img");
      image.src = item.image_path;
      image.alt = "";
      image.loading = "lazy";
      card.append(image);
    }

    card.append(copy);
    return card;
  }

  function renderVideo(item) {
    const figure = element("figure", "members__video");

    if (item.video_path) {
      const video = element("video");
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.src = item.video_path;
      if (item.poster_path) video.poster = item.poster_path;
      figure.append(video);
    } else {
      figure.append(element("div", "members__video-placeholder", "Video coming soon"));
    }

    figure.append(element("h3", "", item.title));

    if (item.description) {
      figure.append(element("p", "", item.description));
    }

    return figure;
  }

  function showList(listEl, emptyEl, items, render) {
    listEl.replaceChildren(emptyEl);
    emptyEl.hidden = items.length > 0;
    items.forEach(item => listEl.append(render(item)));
  }

  async function loadGatherings(client) {
    const { data, error } = await client
      .from("member_gatherings")
      .select("id, title, description, starts_at, location, image_path, registration_url")
      .order("sort_order", { ascending: true })
      .order("starts_at", { ascending: true, nullsFirst: false });

    if (error) throw error;
    showList(gatheringList, gatheringEmpty, data || [], renderGathering);
  }

  async function loadBonusVideos(client) {
    const { data, error } = await client
      .from("member_bonus_videos")
      .select("id, title, description, video_path, poster_path")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    showList(videoList, videoEmpty, data || [], renderVideo);
  }

  async function init() {
    if (!window.supabase) return;

    const client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError || !sessionData.session) return;

    const results = await Promise.allSettled([
      loadGatherings(client),
      loadBonusVideos(client)
    ]);

    if (results[0].status === "rejected") {
      console.error("Gatherings failed to load:", results[0].reason);
      gatheringEmpty.textContent = "We couldn't load gatherings. Please refresh the page.";
    }
    if (results[1].status === "rejected") {
      console.error("Bonus videos failed to load:", results[1].reason);
      videoEmpty.textContent = "We couldn't load bonus videos. Please refresh the page.";
    }
  }

  init().catch(error => {
    console.error("Member content error:", error);
  });
})();
