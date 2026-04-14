import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Home, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPools() {
  const supabase = createAdminClient();

  const { data: pools } = await supabase
    .from("pools")
    .select("id, title, neighborhood, city, status, photos, pricing, shifts_config, owner_whatsapp, telegram_chat_id, created_at")
    .order("created_at", { ascending: false });

  const statusColors: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    draft: "bg-slate-100 text-slate-500",
    pending_subscription: "bg-amber-50 text-amber-700",
    suspended: "bg-red-50 text-red-700",
  };

  const statusLabels: Record<string, string> = {
    active: "Publicado",
    draft: "Rascunho",
    pending_subscription: "Aguardando",
    suspended: "Suspenso",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Piscinas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {pools?.length ?? 0} piscinas na plataforma
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(pools || []).map((pool) => {
          const pricing = pool.pricing as { weekday: number; weekend: number } | null;
          const hasShifts = !!(pool.shifts_config as { enabled?: boolean } | null)?.enabled;

          return (
            <Card key={pool.id} className="border-0 shadow-sm overflow-hidden">
              {/* Photo strip */}
              <div className="h-24 bg-gradient-to-br from-sky-100 to-cyan-50 overflow-hidden">
                {pool.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pool.photos[0]} alt={pool.title} className="w-full h-full object-cover" />
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{pool.title}</h3>
                    <p className="text-[11px] text-slate-400">
                      {pool.neighborhood}, {pool.city}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${statusColors[pool.status] || ""}`}>
                    {statusLabels[pool.status] || pool.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {pricing && (
                    <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                      R$ {pricing.weekday} / R$ {pricing.weekend}
                    </span>
                  )}
                  {hasShifts && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Turnos</span>
                  )}
                  <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                    📷 {pool.photos?.length || 0}
                  </span>
                  {pool.owner_whatsapp && (
                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">WhatsApp</span>
                  )}
                  {pool.telegram_chat_id && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Telegram</span>
                  )}
                </div>

                {pool.status === "active" && (
                  <Link
                    href={`/pool/${pool.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-700 font-medium"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver página pública
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!pools || pools.length === 0) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Home className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhuma piscina cadastrada.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
