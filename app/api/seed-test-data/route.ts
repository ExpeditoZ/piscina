import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/seed-test-data
 *
 * One-time seed script that creates:
 * 1. Host account (pedro@gmail.com / pedro123)
 * 2. Complete pool listing (active)
 * 3. Active subscription + approved invoice
 * 4. Test bookings (negotiating + confirmed)
 *
 * Safe to run multiple times — uses upsert logic.
 * DELETE THIS ROUTE BEFORE PRODUCTION DEPLOYMENT.
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    // ========================================
    // 1. CREATE OR FIND HOST ACCOUNT
    // ========================================
    let userId: string;

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email === "pedro@gmail.com"
    );

    if (existing) {
      userId = existing.id;
      // Update password in case it changed
      await admin.auth.admin.updateUserById(userId, {
        password: "pedro123",
        email_confirm: true,
      });
      console.log("✅ Found existing user:", userId);
    } else {
      const { data: newUser, error: authError } =
        await admin.auth.admin.createUser({
          email: "pedro@gmail.com",
          password: "pedro123",
          email_confirm: true, // Skip email verification
        });

      if (authError || !newUser.user) {
        return Response.json(
          { error: `Auth error: ${authError?.message}` },
          { status: 500 }
        );
      }
      userId = newUser.user.id;
      console.log("✅ Created new user:", userId);
    }

    // ========================================
    // 2. CREATE POOL LISTING
    // ========================================

    // Test photos — high-quality pool images from Unsplash
    const photos = [
      "https://images.unsplash.com/photo-1572331165267-854da2b021b1?w=800&q=80",
      "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&q=80",
      "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=800&q=80",
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80",
    ];

    const poolData = {
      owner_id: userId,
      title: "Piscina Paraíso do Pedro",
      neighborhood: "Centro",
      city: "Boa Viagem",
      exact_address: "Rua das Palmeiras, 123",
      key_lockbox_instructions: "Cofre no portão lateral, senha 2580",
      owner_whatsapp: "5581999887766",
      photos,
      pricing: { weekday: 300, weekend: 500 },
      shifts_config: {
        enabled: true,
        options: [
          { name: "Manhã (8h-15h)", price: 250 },
          { name: "Noite (16h-23h)", price: 320 },
        ],
      },
      rules:
        "Proibido garrafas de vidro. Máximo 15 pessoas. Som alto somente até 22h.",
      upsell_extras: [
        { id: "1", name: "Saco de Gelo", price: 20 },
        { id: "2", name: "Taxa de Limpeza", price: 80 },
        { id: "3", name: "Área de Churrasqueira", price: 50 },
      ],
      telegram_chat_id: null,
      status: "active" as const,
    };

    // Check if pool already exists for this user
    const { data: existingPool } = await admin
      .from("pools")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    let poolId: string;

    if (existingPool) {
      // Update existing pool
      const { error } = await admin
        .from("pools")
        .update(poolData)
        .eq("id", existingPool.id);

      if (error) {
        return Response.json(
          { error: `Pool update error: ${error.message}` },
          { status: 500 }
        );
      }
      poolId = existingPool.id;
      console.log("✅ Updated existing pool:", poolId);
    } else {
      // Insert new pool
      const { data: newPool, error } = await admin
        .from("pools")
        .insert(poolData)
        .select("id")
        .single();

      if (error || !newPool) {
        return Response.json(
          { error: `Pool insert error: ${error?.message}` },
          { status: 500 }
        );
      }
      poolId = newPool.id;
      console.log("✅ Created new pool:", poolId);
    }

    // ========================================
    // 3. CREATE ACTIVE SUBSCRIPTION
    // ========================================
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    const { data: existingSub } = await admin
      .from("host_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let subscriptionId: string;

    const subData = {
      user_id: userId,
      plan_name: "mensal",
      plan_price: 49.9,
      status: "active",
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    if (existingSub) {
      await admin
        .from("host_subscriptions")
        .update(subData)
        .eq("id", existingSub.id);
      subscriptionId = existingSub.id;
      console.log("✅ Updated subscription:", subscriptionId);
    } else {
      const { data: newSub, error } = await admin
        .from("host_subscriptions")
        .insert(subData)
        .select("id")
        .single();

      if (error || !newSub) {
        return Response.json(
          { error: `Subscription error: ${error?.message}` },
          { status: 500 }
        );
      }
      subscriptionId = newSub.id;
      console.log("✅ Created subscription:", subscriptionId);
    }

    // ========================================
    // 4. CREATE APPROVED INVOICE
    // ========================================
    const { data: existingInvoice } = await admin
      .from("host_invoices")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();

    if (!existingInvoice) {
      const { error } = await admin.from("host_invoices").insert({
        user_id: userId,
        subscription_id: subscriptionId,
        amount: 49.9,
        description: "Assinatura mensal - AlugueSuaPiscina",
        status: "approved",
        mp_payment_id: "TEST_SEED_" + Date.now(),
        mp_status: "approved",
        paid_at: now.toISOString(),
      });

      if (error) {
        console.error("Invoice creation error:", error);
        // Non-fatal — continue
      } else {
        console.log("✅ Created approved invoice");
      }
    }

    // ========================================
    // 5. CREATE TEST BOOKINGS
    // ========================================

    // Calculate dates: 3 days from now (negotiating), 5 days from now (confirmed)
    const negotiatingDate = new Date(now);
    negotiatingDate.setDate(negotiatingDate.getDate() + 3);
    const negotiatingDateStr = negotiatingDate.toISOString().split("T")[0];

    const confirmedDate = new Date(now);
    confirmedDate.setDate(confirmedDate.getDate() + 5);
    const confirmedDateStr = confirmedDate.toISOString().split("T")[0];

    // Delete existing test bookings for clean slate
    await admin
      .from("bookings")
      .delete()
      .eq("pool_id", poolId)
      .in("guest_name", ["Ana Silva", "Carlos Souza"]);

    // Negotiating booking
    const { error: booking1Error } = await admin.from("bookings").insert({
      pool_id: poolId,
      guest_name: "Ana Silva",
      arrival_time: "09:00",
      booking_date: negotiatingDateStr,
      shift_selected: "Manhã (8h-15h)",
      total_price: 270, // shift (250) + ice (20)
      selected_upsells: [{ id: "1", name: "Saco de Gelo", price: 20 }],
      status: "negotiating",
    });

    if (booking1Error) {
      console.error("Booking 1 error:", booking1Error);
    } else {
      console.log("✅ Created negotiating booking for", negotiatingDateStr);
    }

    // Confirmed booking
    const { error: booking2Error } = await admin.from("bookings").insert({
      pool_id: poolId,
      guest_name: "Carlos Souza",
      arrival_time: "10:00",
      booking_date: confirmedDateStr,
      shift_selected: null,
      total_price: 580, // weekend (500) + cleaning (80)
      selected_upsells: [
        { id: "2", name: "Taxa de Limpeza", price: 80 },
      ],
      status: "confirmed",
    });

    if (booking2Error) {
      console.error("Booking 2 error:", booking2Error);
    } else {
      console.log("✅ Created confirmed booking for", confirmedDateStr);
    }

    // ========================================
    // SUMMARY
    // ========================================
    return Response.json({
      ok: true,
      summary: {
        user: {
          id: userId,
          email: "pedro@gmail.com",
          password: "pedro123",
        },
        pool: {
          id: poolId,
          title: "Piscina Paraíso do Pedro",
          status: "active",
          publicUrl: `/pool/${poolId}`,
        },
        subscription: {
          id: subscriptionId,
          status: "active",
          expiresAt: expiresAt.toISOString(),
        },
        bookings: {
          negotiating: {
            guest: "Ana Silva",
            date: negotiatingDateStr,
          },
          confirmed: {
            guest: "Carlos Souza",
            date: confirmedDateStr,
          },
        },
        routes: {
          home: "/",
          poolDetail: `/pool/${poolId}`,
          hostLogin: "/host/login",
          hostDashboard: "/host/dashboard",
          hostBilling: "/host/billing",
        },
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return Response.json(
      {
        error: "Seed failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
