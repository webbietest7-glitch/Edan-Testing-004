import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const STAY_REFERENCE_PREFIX = "EDNSTAY-";

type PaystackTransaction = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha512Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

async function sha256Hex(payload: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)));
}

function constantTimeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function fetchVerifiedTransaction(secret: string, reference: string) {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status !== true) {
    throw new Error(`Paystack verification failed with status ${response.status}`);
  }
  const data = payload.data as PaystackTransaction | null;
  if (!data || typeof data.status !== "string" || data.reference !== reference) {
    throw new Error("Paystack verification returned an unexpected response");
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!supabaseUrl || !serviceKey || !secret) {
      return respond({ error: "Payments are not configured yet." }, 500);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    const expectedSignature = await hmacSha512Hex(secret, rawBody);
    if (!constantTimeEquals(signature, expectedSignature)) {
      return respond({ error: "Invalid signature" }, 401);
    }

    let event: { event?: unknown; data?: { reference?: unknown } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return respond({ error: "Invalid payload" }, 400);
    }

    const eventType = typeof event.event === "string" ? event.event : "";
    const reference = typeof event.data?.reference === "string" ? event.data.reference : "";
    if (!reference.startsWith(STAY_REFERENCE_PREFIX)) {
      return respond({ received: true, ignored: true });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { error: logError } = await admin
      .from("stay_payment_events")
      .upsert(
        { event_key: await sha256Hex(rawBody), event_type: eventType, reference },
        { onConflict: "event_key", ignoreDuplicates: true },
      );
    if (logError) throw logError;

    if (eventType === "charge.success") {
      const transaction = await fetchVerifiedTransaction(secret, reference);
      if (transaction.status === "success") {
        const { error } = await admin.rpc("confirm_stay_payment", {
          p_reference: reference,
          p_transaction_id: transaction.id,
          p_amount_pesewas: transaction.amount,
          p_currency: transaction.currency,
          p_paid_at: transaction.paid_at,
        });
        if (error) throw error;
      }
    } else if (eventType === "charge.failed") {
      const { error } = await admin.rpc("mark_stay_payment_failed", { p_reference: reference });
      if (error) throw error;
    }

    return respond({ received: true });
  } catch (error) {
    console.error("Stay Paystack webhook failed:", error instanceof Error ? error.message : error);
    return respond({ error: "Webhook processing failed" }, 500);
  }
});
