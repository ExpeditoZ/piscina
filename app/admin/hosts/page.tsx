import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminHosts() {
  const supabase = createAdminClient();

  // Fetch pools with subscription info
  const { data: pools } = await supabase
    .from("pools")
    .select("id, title, owner_id, city, neighborhood, status, created_at, photos")
    .order("created_at", { ascending: false });

  const { data: subscriptions } = await supabase
    .from("host_subscriptions")
    .select("user_id, status, plan_name, expires_at");

  // Map subscriptions by user_id
  const subMap = new Map<string, typeof subscriptions extends (infer T)[] | null ? T : never>();
  for (const s of subscriptions || []) {
    subMap.set(s.user_id, s);
  }

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
        <h1 className="text-2xl font-bold text-slate-800">Hosts e Piscinas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {pools?.length ?? 0} anunciantes cadastrados
        </p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Piscina</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Localização</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Assinatura</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Fotos</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(pools || []).map((pool) => {
                  const sub = subMap.get(pool.owner_id);
                  return (
                    <tr key={pool.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 text-sm">{pool.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{pool.id.slice(0, 8)}...</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {pool.neighborhood}, {pool.city}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[pool.status] || "bg-slate-100 text-slate-500"}`}>
                          {statusLabels[pool.status] || pool.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {sub ? (
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              sub.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                            }`}>
                              {sub.status === "active" ? "Ativa" : "Expirada"}
                            </span>
                            {sub.expires_at && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Exp: {new Date(sub.expires_at).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {pool.photos?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(pool.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(!pools || pools.length === 0) && (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhum host cadastrado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
