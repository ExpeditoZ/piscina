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
  Users,
  Flame,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

  // FOMO: Simulated live viewer count (consistent per session)
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    // Generate a believable viewer count (2-8) that changes every 30-60s
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

  // Build current URL for sharing
  const poolUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://aluguesuapiscina.com/pool/${pool.id}`;

  const handleDateSelect = useCallback((date: Date, price: number) => {
    setSelectedDate(date);
    setSelectedPrice(price);
    setCheckoutOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <Link href="/" className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-sky-500" />
            <span className="font-bold text-sm bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
              AlugueSuaPiscina
            </span>
          </Link>

          <ShareButton poolTitle={pool.title} poolUrl={poolUrl} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Image Carousel */}
        <ImageCarousel images={pool.photos} title={pool.title} />

        {/* Title, Location & FOMO */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">
                {pool.title}
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin className="h-4 w-4 text-sky-500 flex-shrink-0" />
                <p className="text-sm text-slate-500">
                  {pool.neighborhood}, {pool.city}
                </p>
              </div>
            </div>
          </div>

          {/* FOMO Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {viewerCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-100 animate-pulse">
                <Flame className="h-3 w-3 text-red-500" />
                <span className="text-xs font-semibold text-red-600">
                  {viewerCount} {viewerCount === 1 ? "pessoa vendo" : "pessoas vendo"} agora
                </span>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
              <Users className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">
                Reserva instantânea
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Card */}
        <Card className="border-0 shadow-md shadow-sky-100/50 bg-gradient-to-br from-white to-sky-50/30 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <h2 className="font-semibold text-slate-800">Preços</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-xl bg-white shadow-sm border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Dia de semana</p>
                <p className="text-2xl font-bold text-slate-800">
                  R$ {pool.pricing.weekday}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm border border-amber-100">
                <p className="text-xs text-amber-600 mb-1">Final de semana</p>
                <p className="text-2xl font-bold text-amber-700">
                  R$ {pool.pricing.weekend}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== INTELLIGENT CALENDAR ===== */}
        <PoolCalendar
          poolId={pool.id}
          pricing={pool.pricing}
          onDateSelect={handleDateSelect}
        />

        {/* Shifts */}
        {hasShifts && (
          <Card className="border-0 shadow-md shadow-slate-200/40 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-amber-500" />
                <h2 className="font-semibold text-slate-800">
                  Turnos Disponíveis
                </h2>
              </div>
              <div className="space-y-2">
                {pool.shifts_config!.options.map((shift, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <span className="text-sm text-slate-700 font-medium">
                      {shift.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className="font-bold text-emerald-700 bg-emerald-50 border-emerald-100"
                    >
                      R$ {shift.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extras */}
        {hasExtras && (
          <Card className="border-0 shadow-md shadow-slate-200/40 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="h-4 w-4 text-purple-500" />
                <h2 className="font-semibold text-slate-800">
                  Extras Disponíveis
                </h2>
              </div>
              <div className="space-y-2">
                {pool.upsell_extras!.map((extra) => (
                  <div
                    key={extra.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <span className="text-sm text-slate-700">{extra.name}</span>
                    <Badge
                      variant="secondary"
                      className="font-bold text-purple-700 bg-purple-50 border-purple-100"
                    >
                      + R$ {extra.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rules */}
        {hasRules && (
          <Card className="border-0 shadow-md shadow-slate-200/40 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <ScrollText className="h-4 w-4 text-slate-500" />
                <h2 className="font-semibold text-slate-800">
                  Regras da Piscina
                </h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {pool.rules}
              </p>
            </CardContent>
          </Card>
        )}

        <Separator />
      </main>

      {/* Sticky Bottom CTA — prompts date selection when no date picked */}
      {!checkoutOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400">A partir de</p>
              <p className="text-lg font-bold text-slate-800">
                R$ {minPrice}
                <span className="text-sm font-normal text-slate-400">
                  /dia
                </span>
              </p>
            </div>
            <a
              href="#calendar"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold text-sm shadow-lg shadow-sky-300/40 transition-all duration-200 hover:shadow-xl"
            >
              <CalendarDays className="h-4 w-4" />
              Escolher data
            </a>
          </div>
        </div>
      )}

      {/* Checkout Modal — no private data passed as props */}
      <CheckoutModal
        pool={pool}
        selectedDate={selectedDate}
        basePrice={selectedPrice}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} AlugueSuaPiscina. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
