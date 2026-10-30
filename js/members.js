
/* =========================================
   ƐDAN — MEMBER ACCESS
   Requires Supabase JS v2
   ========================================= */

(() => {
  "use strict";

  // Use the same public credentials as account.js.
  const SUPABASE_URL = "https://qavarsxjqxogfilpgyxn.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdmFyc3hqcXhvZ2ZpbHBneXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDkzMTUsImV4cCI6MjEwODkyNTMxNX0.1tKvqzcirTrYoSsZmxdNykmIzQP_wu_XsjRT1lq8zEs";

  const message = document.getElementById("membersMessage");
  const greeting = document.getElementById("memberGreeting");
  const intro = document.getElementById("memberIntro");
  const tierLabel = document.getElementById("memberTier");
  const statusLabel = document.getElementById("memberStatus");
  const annualLocked = document.getElementById("annualLocked");
  const memberBlocks = document.querySelectorAll(".members__block, .members__privileges");
  const annualBlocks = document.querySelectorAll(".members__block--annual");
  const logoutButton = document.getElementById("memberLogout");
  const receiptPanel = document.getElementById("receiptPanel");
  const downloadButton = document.getElementById("downloadReceipt");
  const receiptMessage = document.getElementById("receiptMessage");

  function showMessage(text) {
    message.textContent = text;
  }

  function setMembershipView(membership) {
    const tier = membership?.membership_tier;
    const status = membership?.membership_status;

    tierLabel.textContent = tier || "Not assigned";
    statusLabel.textContent = status || "Pending approval";

    const active =
      status === "active" &&
      (tier === "monthly" || tier === "annual") &&
      (!membership.expires_at ||
        new Date(membership.expires_at).getTime() > Date.now());

    if (!active) {
      intro.textContent =
        "Your account is ready. Your membership is awaiting activation or renewal by the Ɛdan team.";

      memberBlocks.forEach(block => {
        block.hidden = true;
      });
      annualLocked.hidden = true;
      return;
    }

    intro.textContent =
      `Your ${tier} membership is active. Welcome to your Ɛdan member space.`;

    memberBlocks.forEach(block => {
      block.hidden = false;
    });

    const isAnnual = tier === "annual";
    annualBlocks.forEach(block => {
      block.hidden = !isAnnual;
    });
    annualLocked.hidden = isAnnual;
  }

  async function setupReceipt(client, accessToken, userId) {
    const { data: payment, error } = await client
      .from("payment_transactions")
      .select("reference")
      .eq("user_id", userId)
      .eq("status", "success")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Receipt lookup failed:", error);
      return;
    }
    if (!payment?.reference) return;

    receiptPanel.hidden = false;
    downloadButton.addEventListener("click", () =>
      downloadReceipt(accessToken, payment.reference)
    );
  }

  async function downloadReceipt(accessToken, reference) {
    downloadButton.disabled = true;
    receiptMessage.textContent = "Preparing your receipt…";

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-receipt`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reference })
      });
      if (!response.ok) {
        throw new Error(`Receipt download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edan-receipt-${reference}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      receiptMessage.textContent = "";
    } catch (error) {
      console.error("Receipt download error:", error);
      receiptMessage.textContent = "We couldn't download your receipt. Please try again.";
    } finally {
      downloadButton.disabled = false;
    }
  }

  async function init() {
    if (
      SUPABASE_URL.startsWith("YOUR_") ||
      SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
    ) {
      showMessage("Add your Supabase Project URL and publishable key to js/members.js.");
      return;
    }

    if (!window.supabase) {
      showMessage("Supabase did not load. Refresh the page and try again.");
      return;
    }

    const client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError || !sessionData.session) {
      window.location.replace("../login/?next=members");
      return;
    }

    const user = sessionData.session.user;
    const fullName = user.user_metadata?.full_name?.trim();

    greeting.textContent = fullName
      ? `Welcome, ${fullName}.`
      : "Welcome to Ɛdan.";

    setupReceipt(client, sessionData.session.access_token, user.id);

    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("membership_tier, membership_status, started_at, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Membership lookup failed:", membershipError);
      showMessage("We couldn't load your membership. Please try again later.");
      return;
    }

    if (!membership) {
      setMembershipView(null);
      return;
    }

    if (
      membership.membership_status === "active" &&
      membership.expires_at &&
      new Date(membership.expires_at).getTime() <= Date.now()
    ) {
      setMembershipView({
        ...membership,
        membership_status: "expired"
      });
      return;
    }

    setMembershipView(membership);
  }

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    const client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    const { error } = await client.auth.signOut();

    if (error) {
      showMessage("We couldn't log you out. Please try again.");
      logoutButton.disabled = false;
      return;
    }

    window.location.replace("../");
  });

  init().catch(error => {
    console.error("Member page error:", error);
    showMessage("Something went wrong while loading your membership.");
  });
})();
