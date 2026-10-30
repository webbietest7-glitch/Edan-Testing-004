import { supabase } from "./supabase-client.js";
import { formatDate, renderEmptyRow, createRow } from "./admin-table.js";

const APPLICATION_LIMIT = 100;
const MEMBER_LIMIT = 100;

const applicationsBody = document.getElementById("applicationsBody");
const membersBody = document.getElementById("membersBody");
const reviewDialog = document.getElementById("reviewDialog");
const reviewForm = document.getElementById("reviewForm");
const reviewEmail = document.getElementById("reviewEmail");
const reviewTier = document.getElementById("reviewTier");
const reviewStart = document.getElementById("reviewStart");
const reviewEnd = document.getElementById("reviewEnd");
const reviewError = document.getElementById("reviewError");
const approveButton = document.getElementById("approveButton");
const rejectButton = document.getElementById("rejectButton");
const reviewCancel = document.getElementById("reviewCancel");

const TIER_LABELS = { monthly: "Monthly", annual: "Annual" };

function setReviewBusy(isBusy) {
  approveButton.disabled = isBusy;
  rejectButton.disabled = isBusy;
  reviewCancel.disabled = isBusy;
}

function setReviewError(text) {
  reviewError.textContent = text;
  reviewError.hidden = !text;
}

function renderApplicationRow(application) {
  const row = createRow([
    application.applicant_email,
    formatDate(application.created_at),
    application.status
  ]);

  const actionCell = document.createElement("td");

  if (application.status === "pending") {
    const reviewButton = document.createElement("button");
    reviewButton.type = "button";
    reviewButton.className = "admin__button admin__button--small";
    reviewButton.textContent = "Review";
    reviewButton.dataset.applicationId = application.id;
    reviewButton.dataset.applicantEmail = application.applicant_email;
    actionCell.append(reviewButton);
  }

  row.append(actionCell);
  return row;
}

async function loadApplications() {
  const { data, error } = await supabase
    .from("membership_applications")
    .select("id, applicant_email, status, created_at")
    .order("created_at", { ascending: false })
    .limit(APPLICATION_LIMIT);

  if (error) throw error;

  if (!data.length) {
    renderEmptyRow(applicationsBody, 4, "No applications yet.");
    return;
  }

  applicationsBody.replaceChildren(...data.map(renderApplicationRow));
}

async function loadMembers() {
  const { data, error } = await supabase
    .from("memberships")
    .select("member_email, membership_tier, membership_status, expires_at")
    .order("created_at", { ascending: false })
    .limit(MEMBER_LIMIT);

  if (error) throw error;

  if (!data.length) {
    renderEmptyRow(membersBody, 4, "No members yet.");
    return;
  }

  membersBody.replaceChildren(...data.map(member => createRow([
    member.member_email,
    TIER_LABELS[member.membership_tier] ?? "—",
    member.membership_status,
    formatDate(member.expires_at)
  ])));
}

export async function loadMemberships() {
  await Promise.all([loadApplications(), loadMembers()]);
}

function openReview(applicationId, applicantEmail) {
  reviewForm.reset();
  setReviewError("");
  reviewEmail.textContent = applicantEmail;
  reviewDialog.dataset.applicationId = applicationId;
  reviewDialog.showModal();
}

function toStartOfDayIso(dateValue) {
  return new Date(`${dateValue}T00:00:00Z`).toISOString();
}

function toEndOfDayIso(dateValue) {
  return new Date(`${dateValue}T23:59:59Z`).toISOString();
}

applicationsBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-application-id]");
  if (!button) return;
  openReview(button.dataset.applicationId, button.dataset.applicantEmail);
});

reviewCancel.addEventListener("click", () => reviewDialog.close());

approveButton.addEventListener("click", async () => {
  if (!reviewForm.reportValidity()) return;

  setReviewError("");
  setReviewBusy(true);

  const { error } = await supabase.rpc("approve_membership_application", {
    p_application_id: reviewDialog.dataset.applicationId,
    p_tier: reviewTier.value,
    p_started_at: toStartOfDayIso(reviewStart.value),
    p_expires_at: toEndOfDayIso(reviewEnd.value)
  });

  setReviewBusy(false);

  if (error) {
    setReviewError(error.message);
    return;
  }

  reviewDialog.close();
  await loadMemberships();
});

rejectButton.addEventListener("click", async () => {
  if (!window.confirm(`Reject the application from ${reviewEmail.textContent}?`)) return;

  setReviewError("");
  setReviewBusy(true);

  const { error } = await supabase.rpc("reject_membership_application", {
    p_application_id: reviewDialog.dataset.applicationId
  });

  setReviewBusy(false);

  if (error) {
    setReviewError(error.message);
    return;
  }

  reviewDialog.close();
  await loadMemberships();
});
