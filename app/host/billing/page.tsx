"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Star,
  Zap,
  Calendar,
  Shield,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface SubscriptionData {
  status: string;
  plan_name: string;
  plan_price: number;
  starts_at: string | null;
  expires_at: string | null;
}

interface InvoiceData {
  id: string;
  amount: number;
  status: string;
  mp_qr_code: string | null;
  mp_qr_code_base64: string | null;
  paid_at: string | null;
  created_at: string;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null
  );
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const { data: sub } = await supabase
      .from("host_subscriptions")
      .select("status, plan_name, plan_price, starts_at, expires_at")
      .maybeSingle();

    const { data: invs } = await supabase
      .from("host_invoices")
      .select(
        "id, amount, status, mp_qr_code, mp_qr_code_base64, paid_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(10);

    setSubscription(sub);
    setInvoices(invs || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleGeneratePix() {
    setGenerating(true);
    try {
      const res = await fetch("/api/create-pix-invoice", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erro ao gerar PIX.");
        return;
      }

      setPixData({
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
      });

      toast.success("PIX gerado com sucesso!");
      fetchData(); // Refresh invoices
    } catch {
      toast.error("Erro ao gerar pagamento.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyPix() {
    if (!pixData?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar.");
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function daysRemaining(): number | null {
    if (!subscription?.expires_at) return null;
    const diff =
      new Date(subscription.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/30 to-cyan-50/20">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const days = daysRemaining();
  const isActive = subscription?.status === "active";
  const isExpired = subscription?.status === "expired";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-cyan-50/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link
            href="/host/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Painel
          </Link>
          <span className="font-bold text-lg bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
            Assinatura
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Subscription Status Card */}
        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <div
            className={`h-1.5 ${
              isActive
                ? "bg-gradient-to-r from-emerald-400 to-green-500"
                : isExpired
                  ? "bg-gradient-to-r from-red-400 to-rose-500"
                  : "bg-gradient-to-r from-amber-400 to-orange-500"
            }`}
          />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {isActive ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : isExpired ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-500" />
                  )}
                  <h2 className="text-lg font-bold text-slate-800">
                    {isActive
                      ? "Assinatura ativa"
                      : isExpired
                        ? "Assinatura expirada"
                        : "Sem assinatura ativa"}
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  Plano Mensal — R$ 49,90/mês
                </p>
                {isActive && days !== null && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">
                    {days} {days === 1 ? "dia restante" : "dias restantes"} •
                    Expira em {formatDate(subscription?.expires_at ?? null)}
                  </p>
                )}
                {isExpired && (
                  <p className="text-xs text-red-600 mt-1">
                    Expirou em{" "}
                    {formatDate(subscription?.expires_at ?? null)}. Seu
                    anúncio está suspenso.
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-slate-800">
                  R$ 49,90
                </span>
                <span className="text-xs text-slate-400 block">/mês</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* VALUE PROPOSITION — shown when not subscribed */}
        {!isActive && (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-sky-50 to-cyan-50 overflow-hidden">
            <CardContent className="p-6">
              <h3 className="text-base font-bold text-slate-800 mb-1">
                O que está incluído na sua assinatura
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Tudo que você precisa para transformar sua piscina em renda.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Star, label: "Anúncio público", desc: "Visível no catálogo" },
                  { icon: Calendar, label: "Calendário", desc: "Turnos, diárias, períodos" },
                  { icon: MessageCircle, label: "WhatsApp", desc: "Reserva direta" },
                  { icon: Zap, label: "Telegram", desc: "Alertas em tempo real" },
                  { icon: Shield, label: "Sem comissão", desc: "100% da reserva é sua" },
                  { icon: CheckCircle2, label: "Extras e regras", desc: "Totalmente personalizado" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60">
                    <Icon className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{label}</p>
                      <p className="text-[10px] text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PIX Payment Section */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <CreditCard className="h-4 w-4 text-sky-500" />
              {isActive ? "Renovar assinatura" : "Ativar assinatura"}
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              {isActive
                ? "Renove antecipadamente. Os dias serão somados à sua assinatura atual."
                : "Gere o código PIX abaixo para ativar sua assinatura e publicar seu anúncio."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pixData ? (
              <Button
                onClick={handleGeneratePix}
                disabled={generating}
                className="w-full h-12 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-sky-300/40 transition-all rounded-xl"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Gerando PIX...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Gerar pagamento PIX — R$ 49,90
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                {/* QR Code */}
                {pixData.qrCodeBase64 && (
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                        alt="QR Code PIX"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                )}

                {/* Copia e Cola */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">
                    PIX Copia e Cola
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pixData.qrCode}
                      readOnly
                      className="flex-1 h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 truncate"
                    />
                    <Button
                      onClick={handleCopyPix}
                      variant="outline"
                      size="sm"
                      className="h-10 px-3"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Refresh */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-400">
                    Após pagar, seu anúncio será ativado automaticamente.
                  </p>
                  <Button
                    onClick={() => {
                      fetchData();
                      toast.info("Status atualizado.");
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-sky-500"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice History */}
        {invoices.length > 0 && (
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">
                Histórico de pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm text-slate-700 font-medium">
                        R$ {Number(inv.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(inv.created_at)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        inv.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : inv.status === "pending"
                            ? "bg-amber-50 text-amber-700"
                            : inv.status === "expired"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-red-50 text-red-700"
                      }`}
                    >
                      {inv.status === "approved"
                        ? "Pago"
                        : inv.status === "pending"
                          ? "Pendente"
                          : inv.status === "expired"
                            ? "Expirado"
                            : "Cancelado"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
