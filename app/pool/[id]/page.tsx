import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { PoolPublic } from "@/lib/types";
import { PoolDetailClient } from "./pool-detail-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pool } = await supabase
    .from("public_pools")
    .select("title, neighborhood, city, pricing")
    .eq("id", id)
    .maybeSingle();

  if (!pool) {
    return { title: "Piscina não encontrada | AlugueSuaPiscina" };
  }

  const basePrice = Math.min(pool.pricing.weekday, pool.pricing.weekend);

  return {
    title: `${pool.title} - ${pool.neighborhood} | AlugueSuaPiscina`,
    description: `Alugue ${pool.title} em ${pool.neighborhood}, ${pool.city} a partir de R$ ${basePrice}/dia. Reserve via WhatsApp sem cadastro!`,
    openGraph: {
      title: `${pool.title} - AlugueSuaPiscina`,
      description: `Piscina incrível em ${pool.neighborhood}, ${pool.city}. A partir de R$ ${basePrice}/dia.`,
      type: "website",
      locale: "pt_BR",
    },
  };
}

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch public pool data
  const { data: pool, error } = await supabase
    .from("public_pools")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !pool) {
    notFound();
  }

  // Fetch owner's WhatsApp separately (private field not in view)
  const { data: privateData } = await supabase
    .from("pools")
    .select("owner_whatsapp")
    .eq("id", id)
    .maybeSingle();

  return (
    <PoolDetailClient
      pool={pool as PoolPublic}
      ownerWhatsapp={privateData?.owner_whatsapp ?? null}
    />
  );
}
