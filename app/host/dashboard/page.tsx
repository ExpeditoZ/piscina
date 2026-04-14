import Link from "next/link";
import {
  Waves,
  Plus,
  Settings,
  Eye,
  EyeOff,
  AlertTriangle,
  CreditCard,
  ExternalLink,
  CalendarCheck,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerPool, getOwnerStats, signOut } from "./actions";
import { PoolForm } from "./pool-form";
import type { PoolStatus } from "@/lib/types";

// Status display config
const STATUS_CONFIG: Record<
  PoolStatus,
  {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
  }
> = {
  draft: {
    label: "Rascunho",
    description:
      "Seu anúncio ainda não está publicado. Complete as informações e salve para continuar.",
    color: "text-slate-600",
    bgColor: "bg-slate-50 border-slate-200",
    icon: <EyeOff className="h-4 w-4 text-slate-400" />,
  },
  pending_subscription: {
    label: "Aguardando assinatura",
    description:
      "Seu anúncio está pronto! Assine o plano mensal para publicá-lo no catálogo.",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
    icon: <CreditCard className="h-4 w-4 text-amber-500" />,
  },
  active: {
    label: "Publicado",
    description:
      "Seu anúncio está visível no catálogo público. Os hóspedes podem reservar sua piscina.",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
    icon: <Eye className="h-4 w-4 text-emerald-500" />,
  },
  suspended: {
    label: "Suspenso",
    description:
      "Sua assinatura expirou. Renove para reativar seu anúncio no catálogo.",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
  },
};

export default async function HostDashboard() {
  const pool = await getOwnerPool();
  const status = pool?.status ?? "draft";
  const statusConfig = STATUS_CONFIG[status];
  const stats = pool ? await getOwnerStats(pool.id) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-cyan-50/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400 shadow-md shadow-sky-300/30">
                <Waves className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
                Painel
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {pool && status === "active" && (
              <Link
                href={`/pool/${pool.id}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Ver anúncio
              </Link>
            )}
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {!pool ? (
          /* No pool yet — Show welcome + form */
          <div className="space-y-8">
            <Card className="border-0 shadow-lg shadow-sky-100/50 bg-gradient-to-br from-white to-sky-50/50 overflow-hidden">
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-xl shadow-sky-300/40 mb-5">
                  <Plus className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  Cadastre sua piscina
                </h2>
                <p className="text-slate-500 max-w-md mx-auto">
                  Preencha as informações abaixo para criar seu anúncio. Depois,
                  ative sua assinatura para publicar no catálogo.
                </p>
              </CardContent>
            </Card>
            <PoolForm pool={null} />
          </div>
        ) : (
          /* Has pool — Show stats + status + form */
          <div className="space-y-6">
            {/* Status Banner */}
            <div
              className={`flex items-start gap-3 p-4 rounded-xl border ${statusConfig.bgColor}`}
            >
              <div className="mt-0.5">{statusConfig.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
                <p
                  className={`text-xs mt-0.5 ${statusConfig.color} opacity-80`}
                >
                  {statusConfig.description}
                </p>
              </div>
              {(status === "pending_subscription" ||
                status === "suspended") && (
                <Link
                  href="/host/billing"
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {status === "pending_subscription"
                    ? "Assinar agora"
                    : "Renovar assinatura"}
                </Link>
              )}
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-0 shadow-md bg-white">
                  <CardContent className="p-4 text-center">
                    <div className="inline-flex p-2 rounded-lg bg-sky-50 mb-2">
                      <CalendarCheck className="h-4 w-4 text-sky-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {stats.totalBookings}
                    </p>
                    <p className="text-xs text-slate-400">Total reservas</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-white">
                  <CardContent className="p-4 text-center">
                    <div className="inline-flex p-2 rounded-lg bg-emerald-50 mb-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {stats.confirmedBookings}
                    </p>
                    <p className="text-xs text-slate-400">Confirmadas</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-white">
                  <CardContent className="p-4 text-center">
                    <div className="inline-flex p-2 rounded-lg bg-amber-50 mb-2">
                      <DollarSign className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      R${" "}
                      {stats.totalRevenue.toLocaleString("pt-BR", {
                        minimumFractionDigits: 0,
                      })}
                    </p>
                    <p className="text-xs text-slate-400">Receita total</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-white">
                  <CardContent className="p-4 text-center">
                    <div className="inline-flex p-2 rounded-lg bg-purple-50 mb-2">
                      <Users className="h-4 w-4 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {stats.upcomingBookings.length}
                    </p>
                    <p className="text-xs text-slate-400">Próximas</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Upcoming Bookings */}
            {stats && stats.upcomingBookings.length > 0 && (
              <Card className="border-0 shadow-md bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-sky-500" />
                    Próximas reservas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-slate-100">
                    {stats.upcomingBookings.map((booking, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {booking.guest_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(
                              booking.booking_date + "T12:00:00"
                            ).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              weekday: "short",
                            })}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">
                          R$ {booking.total_price}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pool title + form */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 shadow-lg shadow-emerald-300/40">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {pool.title}
                </h2>
                <p className="text-sm text-slate-500">
                  Edite as configurações da sua piscina
                </p>
              </div>
            </div>

            <PoolForm pool={pool} />
          </div>
        )}
      </main>
    </div>
  );
}
