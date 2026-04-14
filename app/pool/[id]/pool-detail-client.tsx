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

  // Only select the date — no modal
  const handleDateSelect = useCallback((date: Date, price: number) => {
    setSelectedDate(date);
    setSelectedPrice(price);
  }, []);

  // CTA opens checkout or scrolls to calendar
  const handleCTA = useCallback(() => {
    if (!selectedDate) {
      document
        .getElementById("calendar")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setCheckoutOpen(true);
  }, [selectedDate]);

  return (
    <>
      {/* ===== PAGE WRAPPER — pb accounts for sticky bar height ===== */}
      <div className="min-h-screen bg-slate-50 pb-[72px]">
        {/* HEADER */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
          <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors active:scale-95"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <Link href="/" className="flex items-center gap-1.5">
              <Waves className="h-4 w-4 text-sky-500" />
              <span className="font-bold text-sm bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
                AlugueSuaPiscina
              </span>
            </Link>

            <ShareButton poolTitle={pool.title} poolUrl={poolUrl} />
          </div>
        </header>

        {/* CAROUSEL — full bleed mobile, padded desktop */}
        <div className="sm:max-w-2xl sm:lg:max-w-4xl sm:mx-auto sm:px-4 sm:pt-4">
          <ImageCarousel images={pool.photos} title={pool.title} />
        </div>

        {/* CONTENT */}
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 pt-4 space-y-4">
          {/* Title + Location */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {pool.title}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
              <span className="text-[13px] text-slate-500">
                {pool.neighborhood}, {pool.city}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {viewerCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-100 text-[11px] font-semibold text-red-600">
                  <Flame className="h-3 w-3 animate-pulse" />
                  {viewerCount} vendo agora
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-[11px] font-medium text-emerald-600">
                <MessageCircle className="h-3 w-3" />
                Via WhatsApp
              </span>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Dia de semana
              </p>
              <p className="text-lg font-extrabold text-slate-800 mt-0.5">
                R$ {pool.pricing.weekday}
              </p>
            </div>
            <div className="bg-orange-50/60 rounded-xl p-3 border border-orange-100 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-orange-500">
                Fim de semana
              </p>
              <p className="text-lg font-extrabold text-orange-700 mt-0.5">
                R$ {pool.pricing.weekend}
              </p>
            </div>
          </div>

          {/* Calendar */}
          <PoolCalendar
            poolId={pool.id}
            pricing={pool.pricing}
            onDateSelect={handleDateSelect}
          />

          {/* Shifts */}
          {hasShifts && (
            <div className="bg-white rounded-xl border border-slate-100">
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h2 className="font-bold text-[13px] text-slate-800">
                  Turnos Disponíveis
                </h2>
              </div>
              <div className="px-3 pb-3 space-y-1.5">
                {pool.shifts_config!.options.map((shift, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100"
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

          {/* Extras */}
          {hasExtras && (
            <div className="bg-white rounded-xl border border-slate-100">
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-purple-500" />
                <h2 className="font-bold text-[13px] text-slate-800">
                  Extras Disponíveis
                </h2>
              </div>
              <div className="px-3 pb-3 space-y-1.5">
                {pool.upsell_extras!.map((extra) => (
                  <div
                    key={extra.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100"
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

          {/* Rules */}
          {hasRules && (
            <div className="bg-white rounded-xl border border-slate-100">
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-slate-400" />
                <h2 className="font-bold text-[13px] text-slate-800">
                  Regras da Piscina
                </h2>
              </div>
              <div className="px-4 pb-3">
                <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-line">
                  {pool.rules}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 pb-2 text-center">
            <p className="text-[10px] text-slate-300">
              © {new Date().getFullYear()} AlugueSuaPiscina
            </p>
          </div>
        </div>
      </div>

      {/* ===== STICKY BOTTOM CTA =====
          OUTSIDE the scroll container.
          fixed + bottom-0 + z-50.
          pb-[72px] on the page body keeps content from hiding behind this.
      */}
      {!checkoutOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200"
          style={{
            boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="max-w-2xl lg:max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5">
            {/* Price */}
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                {selectedDate ? "Selecionado" : "A partir de"}
              </p>
              <p className="text-lg font-extrabold text-slate-800 leading-tight">
                R$ {selectedDate ? selectedPrice : minPrice}
                <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                  /dia
                </span>
              </p>
            </div>

            {/* Button */}
            <button
              onClick={handleCTA}
              className={`h-11 px-5 sm:px-6 rounded-xl font-bold text-[14px] flex items-center gap-1.5 transition-colors active:scale-[0.97] ${
                selectedDate
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-sky-500 hover:bg-sky-600 text-white"
              }`}
            >
              {selectedDate ? (
                <>
                  Reservar
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                "Escolher data"
              )}
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      <CheckoutModal
        pool={pool}
        selectedDate={selectedDate}
        basePrice={selectedPrice}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />
    </>
  );
}
