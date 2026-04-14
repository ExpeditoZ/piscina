import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminBookings() {
  const supabase = createAdminClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, pool_id, guest_name, booking_date, booking_mode, start_date, end_date, total_days, shift_selected, total_price, status, arrival_time, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Get pool titles
  const poolIds = [...new Set((bookings || []).map(b => b.pool_id))];
  const { data: pools } = await supabase
    .from("pools")
    .select("id, title")
    .in("id", poolIds.length > 0 ? poolIds : ["_"]);

  const poolMap = new Map<string, string>();
  for (const p of pools || []) {
    poolMap.set(p.id, p.title);
  }

  const statusColors: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700",
    negotiating: "bg-amber-50 text-amber-700",
    cancelled: "bg-slate-100 text-slate-500",
  };

  const modeLabels: Record<string, string> = {
    shift: "Turno",
    full_day: "Dia Inteiro",
    range: "Período",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reservas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Últimas {bookings?.length ?? 0} reservas da plataforma
        </p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Hóspede</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Piscina</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Período</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Modo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(bookings || []).map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{b.guest_name}</p>
                      <p className="text-[10px] text-slate-400">{b.arrival_time}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate">
                      {poolMap.get(b.pool_id) || b.pool_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {b.start_date}
                      {b.end_date !== b.start_date && (
                        <span className="text-slate-400"> → {b.end_date}</span>
                      )}
                      {b.shift_selected && (
                        <p className="text-[10px] text-amber-600">{b.shift_selected}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                        {b.booking_mode ? modeLabels[b.booking_mode] || b.booking_mode : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">
                      R$ {Number(b.total_price).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[b.status] || ""}`}>
                        {b.status === "confirmed" ? "Confirmada" : b.status === "negotiating" ? "Negociando" : "Cancelada"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {new Date(b.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!bookings || bookings.length === 0) && (
            <div className="p-8 text-center">
              <CalendarCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhuma reserva registrada.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
