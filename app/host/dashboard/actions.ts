"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Pool } from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/host/login");
}

export async function getOwnerPool(): Promise<Pool | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("pools")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching pool:", error);
    return null;
  }

  return data as Pool | null;
}

export type PoolFormData = {
  title: string;
  neighborhood: string;
  city: string;
  exact_address: string;
  key_lockbox_instructions: string;
  owner_whatsapp: string;
  photos: string[];
  pricing: { weekday: number; weekend: number };
  shifts_config: { enabled: boolean; options: { name: string; price: number }[] } | null;
  rules: string | null;
  upsell_extras: { id: string; name: string; price: number }[] | null;
  telegram_chat_id: string | null;
};

export async function upsertPool(
  poolId: string | null,
  formData: PoolFormData
): Promise<{ error?: string; poolId?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado." };
  }

  // Check if listing meets minimum requirements for publication
  const isComplete =
    !!formData.title.trim() &&
    !!formData.neighborhood.trim() &&
    !!formData.owner_whatsapp.trim() &&
    formData.photos.length > 0;

  const poolData = {
    owner_id: user.id,
    title: formData.title,
    neighborhood: formData.neighborhood,
    city: formData.city,
    exact_address: formData.exact_address || null,
    key_lockbox_instructions: formData.key_lockbox_instructions || null,
    owner_whatsapp: formData.owner_whatsapp || null,
    photos: formData.photos,
    pricing: formData.pricing,
    shifts_config: formData.shifts_config,
    rules: formData.rules || null,
    upsell_extras: formData.upsell_extras,
    telegram_chat_id: formData.telegram_chat_id || null,
  };

  if (poolId) {
    // Fetch current status to determine if we should auto-transition
    const { data: currentPool } = await supabase
      .from("pools")
      .select("status")
      .eq("id", poolId)
      .eq("owner_id", user.id)
      .single();

    // Auto-transition: draft → pending_subscription when requirements met
    const updateData: Record<string, unknown> = { ...poolData };
    if (currentPool?.status === "draft" && isComplete) {
      updateData.status = "pending_subscription";
    }

    const { error } = await supabase
      .from("pools")
      .update(updateData)
      .eq("id", poolId)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Error updating pool:", error);
      return { error: `Erro ao atualizar piscina: ${error.message}` };
    }
  } else {
    // Insert new pool with appropriate status
    const insertData = {
      ...poolData,
      status: isComplete ? "pending_subscription" : "draft",
    };

    const { data, error } = await supabase
      .from("pools")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating pool:", error);
      return { error: `Erro ao criar piscina: ${error.message}` };
    }

    poolId = data.id;
  }

  revalidatePath("/host/dashboard");
  revalidatePath("/");
  return { poolId: poolId! };
}

export async function deletePoolPhoto(photoUrl: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado." };
  }

  try {
    const url = new URL(photoUrl);
    const pathParts = url.pathname.split("/storage/v1/object/public/pool-photos/");
    if (pathParts.length < 2) {
      return { error: "URL da foto inválida." };
    }

    const filePath = pathParts[1];

    const { error } = await supabase.storage
      .from("pool-photos")
      .remove([filePath]);

    if (error) {
      console.error("Error deleting photo:", error);
      return { error: `Erro ao deletar foto: ${error.message}` };
    }

    return {};
  } catch {
    return { error: "Erro ao processar URL da foto." };
  }
}
