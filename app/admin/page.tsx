import {
  Users,
  Home,
  CalendarCheck,
  CreditCard,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const supabase = createAdminClient();

  // Fetch stats
  const [
    { count: totalHosts },
    { count: totalPools },
    { count: activePools },
    { count: totalBookings },
    { count: confirmedBookings },
    { count: activeSubscriptions },
    { count: totalRegions },
    { count: totalCities },
  ] = await Promise.all([
    supabase.from("pools").select("*", { count: "exact", head: true }),
    supabase.from("pools").select("*", { count: "exact", head: true }),
    supabase.from("pools").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("host_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("regions").select("*", { count: "exact", head: true }),
    supabase.from("cities").select("*", { count: "exact", head: true }),
  ]);

  // Revenue
  const { data: revenueData } = await supabase
    .from("bookings")
    .select("total_price")
    .eq("status", "confirmed");

  const totalRevenue = (revenueData || []).reduce(
    (sum, b) => sum + (Number(b.total_price) || 0),
    0
  );

  // Recent bookings
  const { data: recentBookings } = await supabase
    .from("bookings")
    .select("id, guest_name, booking_date, total_price, status, booking_mode, start_date, end_date")
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    { icon: Users, label: "Hosts (pools)", value: totalHosts ?? 0, color: "text-sky-500", bg: "bg-sky-50" },
    { icon: Home, label: "Piscinas ativas", value: activePools ?? 0, color: "text-emerald-500", bg: "bg-emerald-50" },
    { icon: CalendarCheck, label: "Reservas totais", value: totalBookings ?? 0, color: "text-purple-500", bg: "bg-purple-50" },
    { icon: CalendarCheck, label: "Confirmadas", value: confirmedBookings ?? 0, color: "text-green-500", bg: "bg-green-50" },
    { icon: CreditCard, label: "Assinaturas ativas", value: activeSubscriptions ?? 0, color: "text-amber-500", bg: "bg-amber-50" },
    { icon: TrendingUp, label: "Receita total", value: `R$ ${totalRevenue.toLocaleString("pt-BR")}`, color: "text-emerald-500", bg: "bg-emerald-50" },
    { icon: MapPin, label: "Regiões", value: totalRegions ?? 0, color: "text-rose-500", bg: "bg-rose-50" },
    { icon: MapPin, label: "Cidades", value: totalCities ?? 0, color: "text-blue-500", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Visão Geral</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Painel administrativo da plataforma AlugueSuaPiscina
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-xl font-bold text-slate-800">{value}</p>
              <p className="text-[11px] text-slate-400">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent bookings */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Últimas reservas</h2>
          <div className="divide-y divide-slate-100">
            {(recentBookings || []).map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-700">{b.guest_name}</p>
                  <p className="text-xs text-slate-400">
                    {b.start_date}
                    {b.end_date !== b.start_date && ` → ${b.end_date}`}
                    {b.booking_mode && ` · ${b.booking_mode}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">
                    R$ {Number(b.total_price).toLocaleString("pt-BR")}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      b.status === "confirmed"
                        ? "bg-emerald-50 text-emerald-700"
                        : b.status === "negotiating"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {b.status === "confirmed" ? "Confirmada" : b.status === "negotiating" ? "Negociando" : "Cancelada"}
                  </span>
                </div>
              </div>
            ))}
            {(!recentBookings || recentBookings.length === 0) && (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhuma reserva ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
