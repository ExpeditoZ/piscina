import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/mercadopago-webhook
 *
 * Receives payment notifications from Mercado Pago.
 * When a PIX payment is approved:
 * 1. Finds the matching invoice by mp_payment_id
 * 2. Marks the invoice as 'approved'
 * 3. Activates the host subscription (30 days from now, or stacks on existing)
 * 4. Sets the host's pool listing to 'active'
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Mercado Pago sends different notification types
    // We care about "payment" type
    if (body.type !== "payment" && body.action !== "payment.updated") {
      return Response.json({ ok: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return Response.json({ ok: true });
    }

    // Fetch payment details from Mercado Pago to verify status
    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!mpToken) {
      console.error("MERCADO_PAGO_ACCESS_TOKEN not set");
      return Response.json({ ok: true });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${mpToken}`,
        },
      }
    );

    if (!mpResponse.ok) {
      console.error("Failed to fetch payment from MP:", mpResponse.status);
      return Response.json({ ok: true });
    }

    const payment = await mpResponse.json();
    const mpPaymentId = String(payment.id);
    const mpStatus = payment.status; // "approved", "pending", "rejected", etc.

    const admin = createAdminClient();

    // Find the matching invoice
    const { data: invoice, error: findError } = await admin
      .from("host_invoices")
      .select("*, host_subscriptions(*)")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (findError || !invoice) {
      console.error("Invoice not found for payment:", mpPaymentId, findError);
      return Response.json({ ok: true });
    }

    // Update invoice with latest status
    await admin
      .from("host_invoices")
      .update({
        mp_status: mpStatus,
        status: mpStatus === "approved" ? "approved" : invoice.status,
        paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", invoice.id);

    // If payment is approved, activate subscription
    if (mpStatus === "approved" && invoice.status !== "approved") {
      const now = new Date();
      const subscription = invoice.host_subscriptions;

      // Day-stacking: if subscription is still active, add 30 days from expiry
      // Otherwise, start from now
      let startsAt = now;
      let expiresAt: Date;

      if (
        subscription &&
        subscription.status === "active" &&
        subscription.expires_at &&
        new Date(subscription.expires_at) > now
      ) {
        // Stack: add 30 days to existing expiry
        expiresAt = new Date(subscription.expires_at);
        expiresAt.setDate(expiresAt.getDate() + 30);
      } else {
        // Fresh activation: 30 days from now
        startsAt = now;
        expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      // Update subscription
      await admin
        .from("host_subscriptions")
        .update({
          status: "active",
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", invoice.subscription_id);

      // Activate the host's pool listing
      // (move from pending_subscription or suspended → active)
      await admin
        .from("pools")
        .update({
          status: "active",
          updated_at: now.toISOString(),
        })
        .eq("owner_id", invoice.user_id)
        .in("status", ["pending_subscription", "suspended"]);

      console.log(
        `✅ Subscription activated for user ${invoice.user_id} until ${expiresAt.toISOString()}`
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Mercado Pago webhook error:", error);
    // Always return 200 to MP so they don't retry indefinitely
    return Response.json({ ok: true });
  }
}
