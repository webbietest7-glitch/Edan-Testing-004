import { supabase } from "./supabase-client.js";

const PAYSTACK_PUBLIC_KEY = "pk_test_41f2f237f5c3ece88a2e4873079e1bb0ceb70ed4";
const ACCOUNT_PATH = "/login/";
const PLANS = {
  monthly: { label: "Monthly affiliate", amountGhs: 1000 },
  annual: { label: "Annual affiliate", amountGhs: 8000 },
};

const dialog = document.getElementById("payDialog");
const form = document.getElementById("payForm");
const dialogMessage = document.getElementById("payMessage");
const submitButton = form.querySelector('[type="submit"]');
const statusLine = document.getElementById("payStatus");
const closeButton = document.getElementById("payClose");

function setDialogMessage(text) {
  dialogMessage.textContent = text;
  dialogMessage.hidden = !text;
}

function setStatus(text, type = "success") {
  statusLine.textContent = text;
  statusLine.className = `pay-status${type === "error" ? " is-error" : ""}`;
  statusLine.hidden = false;
}

function requestedPlan() {
  const plan = new URLSearchParams(window.location.search).get("plan");
  return Object.hasOwn(PLANS, plan) ? plan : null;
}

async function currentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Could not check the current session:", error.message);
    return null;
  }
  return data.session;
}

function openPayment(session, plan) {
  form.reset();
  form.elements.plan.value = plan;
  form.elements.fullName.value = session.user.user_metadata?.full_name || "";
  form.elements.email.value = session.user.email || "";
  setDialogMessage("");
  statusLine.hidden = true;
  dialog.showModal();
}


function startPaystack({ email, fullName, phone, plan, userId, reference, amount }) {
  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount,
    currency: "GHS",
    channels: ["card", "mobile_money"],
    ref: reference,
    metadata: {
      user_id: userId,
      plan,
      custom_fields: [
        { display_name: "Full name", variable_name: "full_name", value: fullName },
        { display_name: "Phone", variable_name: "phone", value: phone },
      ],
    },
    callback: () => {
      setStatus(
        "Payment submitted. We're verifying it now; your membership will be confirmed after verification."
      );
    },
    onClose: () => {
      setStatus(
        "Payment was not completed. Your application is saved, and you can try paying again from the membership section.",
        "error"
      );
    },
  });

  handler.openIframe();
}


async function handleSubmit(event) {
  event.preventDefault();
  setDialogMessage("");

  if (!form.reportValidity()) return;

  if (!PAYSTACK_PUBLIC_KEY.startsWith("pk_")) {
    setDialogMessage("Online payment isn't connected yet. Please try again later.");
    return;
  }

  const session = await currentSession();
  if (!session) {
    window.location.assign(`${ACCOUNT_PATH}?plan=${form.elements.plan.value}`);
    return;
  }

  const plan = form.elements.plan.value;
  const fullName = form.elements.fullName.value.trim();
  const email = form.elements.email.value.trim();
  const phone = form.elements.phone.value.trim();

  submitButton.disabled = true;

  
  try {
    const { data, error } = await supabase.functions.invoke("create-payment", {
      body: { plan },
    });

    if (error) {
      console.error("Payment initialization failed:", error.message);
      throw new Error("Could not initialize payment");
    }

    if (
      !data?.reference ||
      !Number.isInteger(data.amount) ||
      data.amount <= 0 ||
      data?.currency !== "GHS"
    ) {
      throw new Error("Invalid payment initialization response");
    }

    dialog.close();

    startPaystack({
      email: data.email || email,
      fullName,
      phone,
      plan,
      userId: session.user.id,
      reference: data.reference,
      amount: data.amount,
    });
  } catch (error) {

    console.error("Could not save the membership application:", error);
    setDialogMessage("We couldn't save your application. Please try again.");
  } finally {
    submitButton.disabled = false;
  }
}

async function handlePlanClick(event) {
  event.preventDefault();
  const plan = event.currentTarget.dataset.plan;
  const session = await currentSession();

  if (!session) {
    window.location.assign(`${ACCOUNT_PATH}?plan=${plan}`);
    return;
  }

  openPayment(session, plan);
}

document.querySelectorAll("[data-plan]").forEach((button) => {
  button.addEventListener("click", handlePlanClick);
});

form.addEventListener("submit", handleSubmit);
closeButton.addEventListener("click", () => dialog.close());

async function openRequestedPlan() {
  const plan = requestedPlan();
  if (!plan) return;

  const session = await currentSession();
  if (session) {
    openPayment(session, plan);
  } else {
    window.location.replace(`${ACCOUNT_PATH}?plan=${plan}`);
  }
}

openRequestedPlan();
