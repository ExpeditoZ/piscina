"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  MapPin,
  Clock,
  ShoppingBag,
  ScrollText,
  DollarSign,
  Waves,
  Flame,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/image-carousel";
import { ShareButton } from "@/components/share-button";
import { PoolCalendar } from "@/components/pool-calendar";
import { CheckoutModal } from "@/components/checkout-modal";
import type { PoolPublic } from "@/lib/types";

interface PoolDetailClientProps {
  pool: PoolPublic;
}

export function PoolDetailClient({ pool }: PoolDetailClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // FOMO: Simulated live viewer count
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    const base = 2 + Math.floor(Math.random() * 5);
    setViewerCount(base);
    const interval = setInterval(() => {
      setViewerCount((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.min(12, Math.max(2, prev + delta));
      });
    }, 30000 + Math.random() * 30000);
    return () => clearInterval(interval);
  }, []);

  const hasShifts =
    pool.shifts_config?.enabled && pool.shifts_config.options.length > 0;
  const hasExtras = pool.upsell_extras && pool.upsell_extras.length > 0;
  const hasRules = !!pool.rules;
  const minPrice = Math.min(pool.pricing.weekday, pool.pricing.weekend);

  const poolUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://aluguesuapiscina.com/pool/${pool.id}`;

  // Date selection only — does NOT open checkout
  const handleDateSelect = useCallback((date: Date, price: number) => {
    setSelectedDate(date);
    setSelectedPrice(price);
  }, []);

  // CTA button opens checkout
  const handleOpenCheckout = useCallback(() => {
    if (!selectedDate) {
      // Scroll to calendar
      document
        .getElementById("calendar")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setCheckoutOpen(true);
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 h-13 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors text-sm p-2 -ml-2 rounded-xl hover:bg-slate-50 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">Voltar</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <Waves className="h-4 w-4 text-sky-500" />
            <span className="font-bold text-sm bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
              AlugueSuaPiscina
            </span>
          </Link>

          <ShareButton poolTitle={pool.title} poolUrl={poolUrl} />
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-2xl lg:max-w-4xl mx-auto">
        {/* Image Carousel — full-bleed on mobile */}
        <div className="sm:px-4 sm:pt-4">
          <ImageCarousel images={pool.photos} title={pool.title} />
        </div>

        <div className="px-4 pt-5 pb-32 space-y-5">
          {/* ===== TITLE SECTION ===== */}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">
              {pool.title}
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <MapPin className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
              <p className="text-sm text-slate-500">
                {pool.neighborhood}, {pool.city}
              </p>
            </div>

            {/* FOMO badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {viewerCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-100">
                  <Flame className="h-3 w-3 text-red-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-red-600">
                    {viewerCount} vendo agora
                  </span>
                </div>
              )}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                <MessageCircle className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-600">
                  Reserve via WhatsApp
                </span>
              </div>
            </div>
          </div>

          {/* ===== PRICING ===== */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Dia de semana
              </p>
              <p className="text-2xl font-black text-slate-800">
                R$ {pool.pricing.weekday}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 shadow-sm border border-amber-100/80 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">
                Fim de semana
              </p>
              <p className="text-2xl font-black text-amber-700">
                R$ {pool.pricing.weekend}
              </p>
            </div>
          </div>

          {/* ===== CALENDAR ===== */}
          <PoolCalendar
            poolId={pool.id}
            pricing={pool.pricing}
            onDateSelect={handleDateSelect}
          />

          {/* ===== SHIFTS ===== */}
          {hasShifts && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-50">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <h2 className="font-bold text-sm text-slate-800">
                  Turnos Disponíveis
                </h2>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {pool.shifts_config!.options.map((shift, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-100"
                  >
                    <span className="text-sm text-slate-700 font-medium">
                      {shift.name}
                    </span>
                    <Badge className="font-bold text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">
                      R$ {shift.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== EXTRAS ===== */}
          {hasExtras && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-purple-50">
                  <ShoppingBag className="h-4 w-4 text-purple-500" />
                </div>
                <h2 className="font-bold text-sm text-slate-800">
                  Extras Disponíveis
                </h2>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {pool.upsell_extras!.map((extra) => (
                  <div
                    key={extra.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-100"
                  >
                    <span className="text-sm text-slate-600">
                      {extra.name}
                    </span>
                    <Badge className="font-bold text-purple-700 bg-purple-50 border-purple-200 text-xs">
                      + R$ {extra.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== RULES ===== */}
          {hasRules && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-100">
                  <ScrollText className="h-4 w-4 text-slate-500" />
                </div>
                <h2 className="font-bold text-sm text-slate-800">
                  Regras da Piscina
                </h2>
              </div>
              <div className="px-5 pb-5">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {pool.rules}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== STICKY BOTTOM CTA ===== */}
      {!checkoutOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          {/* Gradient fade */}
          <div className="h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          <div className="bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
            <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Price info */}
                <div className="flex-1 min-w-0">
                  {selectedDate ? (
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        Preço selecionado
                      </p>
                      <p className="text-lg font-black text-slate-800 leading-tight">
                        R$ {selectedPrice}
                        <span className="text-xs font-normal text-slate-400 ml-0.5">
                          /dia
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        A partir de
                      </p>
                      <p className="text-lg font-black text-slate-800 leading-tight">
                        R$ {minPrice}
                        <span className="text-xs font-normal text-slate-400 ml-0.5">
                          /dia
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={handleOpenCheckout}
                  className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all duration-200 active:scale-[0.97] ${
                    selectedDate
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-emerald-300/40"
                      : "bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-sky-300/40"
                  }`}
                >
                  {selectedDate ? (
                    <>
                      Reservar agora
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    "Escolher data"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== CHECKOUT MODAL ===== */}
      <CheckoutModal
        pool={pool}
        selectedDate={selectedDate}
        basePrice={selectedPrice}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} AlugueSuaPiscina. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
