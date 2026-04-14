import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PLAN_PRICE = 49.9;
const PLAN_NAME = "mensal";

/**
 * POST /api/create-pix-invoice
 *
 * Creates a PIX payment via Mercado Pago for the host's monthly subscription.
 * Requires authenticated host session.
 *
 * Flow:
 * 1. Verify host is authenticated
 * 2. Ensure/create host_subscription record
 * 3. Check for existing pending invoice (reuse if valid)
 * 4. Create PIX payment via Mercado Pago API
 * 5. Store invoice with QR code data
 * 6. Return QR code + copia-e-cola to client
 */
export async function POST() {
  try {
    // 1. Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Ensure subscription record exists
    let { data: subscription } = await admin
      .from("host_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!subscription) {
      const { data: newSub, error: subError } = await admin
        .from("host_subscriptions")
        .insert({
          user_id: user.id,
          plan_name: PLAN_NAME,
          plan_price: PLAN_PRICE,
          status: "inactive",
        })
        .select()
        .single();

      if (subError) {
        console.error("Error creating subscription:", subError);
        return Response.json(
          { error: "Erro ao criar assinatura." },
          { status: 500 }
        );
      }
      subscription = newSub;
    }

    // 3. Check for existing pending invoice (reuse if < 30 min old)
    const { data: existingInvoice } = await admin
      .from("host_invoices")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInvoice && existingInvoice.mp_qr_code) {
      return Response.json({
        invoiceId: existingInvoice.id,
        qrCode: existingInvoice.mp_qr_code,
        qrCodeBase64: existingInvoice.mp_qr_code_base64,
        amount: existingInvoice.amount,
        status: "pending",
      });
    }

    // 4. Create PIX payment via Mercado Pago
    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!mpToken) {
      return Response.json(
        { error: "Mercado Pago não configurado." },
        { status: 500 }
      );
    }

    const idempotencyKey = crypto.randomUUID();
    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpToken}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: PLAN_PRICE,
          description: `Assinatura mensal - AlugueSuaPiscina`,
          payment_method_id: "pix",
          payer: {
            email: user.email,
          },
        }),
      }
    );

    if (!mpResponse.ok) {
      const errorData = await mpResponse.text();
      console.error("Mercado Pago error:", errorData);
      return Response.json(
        { error: "Erro ao gerar pagamento PIX." },
        { status: 500 }
      );
    }

    const mpData = await mpResponse.json();
    const transactionData =
      mpData.point_of_interaction?.transaction_data;

    if (!transactionData?.qr_code) {
      console.error("No QR code in MP response:", mpData);
      return Response.json(
        { error: "Erro ao gerar QR code PIX." },
        { status: 500 }
      );
    }

    // 5. Store invoice
    const { data: invoice, error: invoiceError } = await admin
      .from("host_invoices")
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        amount: PLAN_PRICE,
        status: "pending",
        mp_payment_id: String(mpData.id),
        mp_qr_code: transactionData.qr_code,
        mp_qr_code_base64: transactionData.qr_code_base64 || null,
        mp_status: mpData.status,
        expires_at: new Date(
          Date.now() + 30 * 60 * 1000
        ).toISOString(), // 30 min expiry
      })
      .select("id")
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      return Response.json(
        { error: "Erro ao registrar fatura." },
        { status: 500 }
      );
    }

    return Response.json({
      invoiceId: invoice.id,
      qrCode: transactionData.qr_code,
      qrCodeBase64: transactionData.qr_code_base64 || null,
      amount: PLAN_PRICE,
      status: "pending",
    });
  } catch (error) {
    console.error("Create PIX invoice error:", error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
