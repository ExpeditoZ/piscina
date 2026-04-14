"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Pool } from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
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
    // Update existing pool
    const { error } = await supabase
      .from("pools")
      .update(poolData)
      .eq("id", poolId)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Error updating pool:", error);
      return { error: `Erro ao atualizar piscina: ${error.message}` };
    }
  } else {
    // Insert new pool
    const { data, error } = await supabase
      .from("pools")
      .insert(poolData)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating pool:", error);
      return { error: `Erro ao criar piscina: ${error.message}` };
    }

    poolId = data.id;
  }

  revalidatePath("/admin");
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

  // Extract path from URL: .../storage/v1/object/public/pool-photos/owner_id/filename.webp
  try {
    const url = new URL(photoUrl);
    const pathParts = url.pathname.split("/storage/v1/object/public/pool-photos/");
    if (pathParts.length < 2) {
      return { error: "URL da foto inválida." };
    }

    const filePath = pathParts[1]; // owner_id/filename.webp

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
