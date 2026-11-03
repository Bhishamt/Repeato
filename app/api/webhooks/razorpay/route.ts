import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/services";

/**
 * Disabled-by-default Razorpay Webhook Handler.
 * Fails closed safely if live billing is not activated or signature is invalid.
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const isBillingActive = process.env.ENABLE_LIVE_BILLING === "true";

  if (!isBillingActive || !secret) {
    // In production without live billing, webhooks are rejected safely
    return NextResponse.json(
      { error: "Billing and webhooks are safely disabled on this environment." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const db = getDb();

    // Scaffolding: Record audit of subscription events without touching live money
    await audit(db, 0, `billing.${payload.event}`, "subscription", 0, {
      id: payload.payload?.payment?.entity?.id || payload.payload?.subscription?.entity?.id,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[billing:webhook] Error processing webhook event:", err);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}

