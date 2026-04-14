"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  MapPin,
  Clock,
  ShoppingBag,
  ScrollText,
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

  const handleDateSelect = useCallback((date: Date, price: number) => {
    setSelectedDate(date);
    setSelectedPrice(price);
  }, []);

  const handleOpenCheckout = useCallback(() => {
    if (!selectedDate) {
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
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors p-2 -ml-2 rounded-xl hover:bg-slate-50 active:scale-95"
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
        {/* Carousel — edge-to-edge on mobile, padded on sm+ */}
        <div className="sm:px-4 sm:pt-4">
          <ImageCarousel images={pool.photos} title={pool.title} />
        </div>

        {/* All content sections */}
        <div className="px-4 pt-4 pb-24 space-y-4">
          {/* ===== TITLE + LOCATION ===== */}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug tracking-tight">
              {pool.title}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
              <p className="text-[13px] text-slate-500">
                {pool.neighborhood}, {pool.city}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {viewerCount > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-100">
                  <Flame className="h-3 w-3 text-red-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-red-600">
                    {viewerCount} vendo agora
                  </span>
                </div>
              )}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100">
                <MessageCircle className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-600">
                  Via WhatsApp
                </span>
              </div>
            </div>
          </div>

          {/* ===== PRICING ===== */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                Dia de semana
              </p>
              <p className="text-lg font-black text-slate-800">
                R$ {pool.pricing.weekday}
              </p>
            </div>
            <div className="bg-orange-50/70 rounded-xl p-3 border border-orange-100 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-orange-500 mb-0.5">
                Fim de semana
              </p>
              <p className="text-lg font-black text-orange-700">
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
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <div className="p-1 rounded-md bg-amber-50">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <h2 className="font-bold text-[13px] text-slate-800">
                  Turnos Disponíveis
                </h2>
              </div>
              <div className="px-3 pb-3 space-y-1.5">
                {pool.shifts_config!.options.map((shift, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="text-[13px] text-slate-700 font-medium">
                      {shift.name}
                    </span>
                    <Badge className="font-bold text-emerald-700 bg-emerald-50 border-emerald-200 text-[11px]">
                      R$ {shift.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== EXTRAS ===== */}
          {hasExtras && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <div className="p-1 rounded-md bg-purple-50">
                  <ShoppingBag className="h-3.5 w-3.5 text-purple-500" />
                </div>
                <h2 className="font-bold text-[13px] text-slate-800">
                  Extras Disponíveis
                </h2>
              </div>
              <div className="px-3 pb-3 space-y-1.5">
                {pool.upsell_extras!.map((extra) => (
                  <div
                    key={extra.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="text-[13px] text-slate-600">
                      {extra.name}
                    </span>
                    <Badge className="font-bold text-purple-700 bg-purple-50 border-purple-200 text-[11px]">
                      + R$ {extra.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== RULES ===== */}
          {hasRules && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <div className="p-1 rounded-md bg-slate-100">
                  <ScrollText className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <h2 className="font-bold text-[13px] text-slate-800">
                  Regras da Piscina
                </h2>
              </div>
              <div className="px-4 pb-3">
                <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-line">
                  {pool.rules}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== STICKY BOTTOM CTA ===== */}
      {/*
        Structure: fixed at bottom, always visible.
        Uses pb-[env(safe-area-inset-bottom)] for iOS notch.
        z-50 to be above everything except modals.
        Height: ~64px on mobile. Content area never overlaps thanks to pb-24 above.
      */}
      {!checkoutOpen && (
        <div
          className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200"
          style={{
            boxShadow: "0 -2px 16px rgba(0,0,0,0.06)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
            {/* Price */}
            <div className="flex-1 min-w-0">
              {selectedDate ? (
                <>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                    Selecionado
                  </p>
                  <p className="text-base font-black text-slate-800 leading-tight mt-0.5">
                    R$ {selectedPrice}
                    <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                      /dia
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                    A partir de
                  </p>
                  <p className="text-base font-black text-slate-800 leading-tight mt-0.5">
                    R$ {minPrice}
                    <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                      /dia
                    </span>
                  </p>
                </>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleOpenCheckout}
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 h-11 px-5 sm:px-7 rounded-xl font-bold text-[13px] sm:text-[14px] transition-all duration-150 active:scale-[0.96] ${
                selectedDate
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-300/40"
                  : "bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-300/40"
              }`}
            >
              {selectedDate ? (
                <>
                  Reservar agora
                  <ChevronRight className="h-4 w-4 -mr-0.5" />
                </>
              ) : (
                "Escolher data"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===== CHECKOUT ===== */}
      <CheckoutModal
        pool={pool}
        selectedDate={selectedDate}
        basePrice={selectedPrice}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-5 text-center">
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} AlugueSuaPiscina
          </p>
        </div>
      </footer>
    </div>
  );
}
