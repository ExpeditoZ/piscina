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
        { id: "1", name: "Saco de Gelo", price: 20, billing: "per_day" },
        { id: "2", name: "Taxa de Limpeza", price: 80, billing: "per_reservation" },
        { id: "3", name: "Área de Churrasqueira", price: 50, billing: "per_day" },
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
      .in("guest_name", ["Ana Silva", "Carlos Souza", "Maria Fernanda"]);

    // Test Booking 1: Shift booking (negotiating, morning)
    const { error: booking1Error } = await admin.from("bookings").insert({
      pool_id: poolId,
      guest_name: "Ana Silva",
      arrival_time: "09:00",
      booking_date: negotiatingDateStr,
      booking_mode: "shift",
      start_date: negotiatingDateStr,
      end_date: negotiatingDateStr,
      total_days: 1,
      shift_selected: "Manhã (8h-15h)",
      total_price: 270, // shift (250) + ice (20)
      pricing_breakdown: {
        mode: "shift",
        days: [{ date: negotiatingDateStr, price: 250, type: "weekday" }],
        shiftName: "Manhã (8h-15h)",
        shiftPrice: 250,
        subtotalBase: 250,
        extras: [{ id: "1", name: "Saco de Gelo", unitPrice: 20, quantity: 1, total: 20 }],
        subtotalExtras: 20,
        total: 270,
      },
      selected_upsells: [{ id: "1", name: "Saco de Gelo", price: 20, billing: "per_day", quantity: 1, total: 20 }],
      status: "negotiating",
    });

    if (booking1Error) {
      console.error("Booking 1 error:", booking1Error);
    } else {
      console.log("✅ Created shift booking (negotiating) for", negotiatingDateStr);
    }

    // Test Booking 2: Full-day booking (confirmed)
    const { error: booking2Error } = await admin.from("bookings").insert({
      pool_id: poolId,
      guest_name: "Carlos Souza",
      arrival_time: "10:00",
      booking_date: confirmedDateStr,
      booking_mode: "full_day",
      start_date: confirmedDateStr,
      end_date: confirmedDateStr,
      total_days: 1,
      shift_selected: null,
      total_price: 580, // weekend (500) + cleaning (80)
      pricing_breakdown: {
        mode: "full_day",
        days: [{ date: confirmedDateStr, price: 500, type: "weekend" }],
        subtotalBase: 500,
        extras: [{ id: "2", name: "Taxa de Limpeza", unitPrice: 80, quantity: 1, total: 80 }],
        subtotalExtras: 80,
        total: 580,
      },
      selected_upsells: [{ id: "2", name: "Taxa de Limpeza", price: 80, billing: "per_reservation", quantity: 1, total: 80 }],
      status: "confirmed",
    });

    if (booking2Error) {
      console.error("Booking 2 error:", booking2Error);
    } else {
      console.log("✅ Created full_day booking (confirmed) for", confirmedDateStr);
    }

    // Test Booking 3: Range booking (negotiating, 3 days starting 7 days from now)
    const rangeStartDate = new Date(now);
    rangeStartDate.setDate(rangeStartDate.getDate() + 7);
    const rangeEndDate = new Date(rangeStartDate);
    rangeEndDate.setDate(rangeEndDate.getDate() + 2); // 3 days total
    const rangeStartStr = rangeStartDate.toISOString().split("T")[0];
    const rangeEndStr = rangeEndDate.toISOString().split("T")[0];

    const { error: booking3Error } = await admin.from("bookings").insert({
      pool_id: poolId,
      guest_name: "Maria Fernanda",
      arrival_time: "14:00",
      booking_date: rangeStartStr,
      booking_mode: "range",
      start_date: rangeStartStr,
      end_date: rangeEndStr,
      total_days: 3,
      shift_selected: null,
      total_price: 1100,
      pricing_breakdown: {
        mode: "range",
        days: [
          { date: rangeStartStr, price: 300, type: "weekday" },
          { date: new Date(rangeStartDate.getTime() + 86400000).toISOString().split("T")[0], price: 300, type: "weekday" },
          { date: rangeEndStr, price: 500, type: "weekend" },
        ],
        subtotalBase: 1100,
        extras: [],
        subtotalExtras: 0,
        total: 1100,
      },
      selected_upsells: null,
      status: "negotiating",
    });

    if (booking3Error) {
      console.error("Booking 3 error:", booking3Error);
    } else {
      console.log("✅ Created range booking (negotiating) for", rangeStartStr, "→", rangeEndStr);
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
          shift_negotiating: {
            guest: "Ana Silva",
            mode: "shift",
            date: negotiatingDateStr,
            shift: "Manhã (8h-15h)",
          },
          fullday_confirmed: {
            guest: "Carlos Souza",
            mode: "full_day",
            date: confirmedDateStr,
          },
          range_negotiating: {
            guest: "Maria Fernanda",
            mode: "range",
            startDate: rangeStartStr,
            endDate: rangeEndStr,
            totalDays: 3,
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
