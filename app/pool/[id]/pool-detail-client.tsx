"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  MapPin,
  Clock,
  ShoppingBag,
  ScrollText,
  DollarSign,
  Waves,
} from "lucide-react";
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
  ownerWhatsapp: string | null;
}

export function PoolDetailClient({ pool, ownerWhatsapp }: PoolDetailClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const hasShifts =
    pool.shifts_config?.enabled && pool.shifts_config.options.length > 0;
  const hasExtras = pool.upsell_extras && pool.upsell_extras.length > 0;
  const hasRules = !!pool.rules;

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
    <div className="min-h-screen bg-[#FAFAFA]">
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

          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-sky-500" />
            <span className="font-bold text-sm bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
              AlugueSuaPiscina
            </span>
          </div>

          <div className="w-16" /> {/* Spacer */}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Image Carousel */}
        <ImageCarousel images={pool.photos} title={pool.title} />

        {/* Title & Location */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">
            {pool.title}
          </h1>
          <div className="flex items-center gap-1.5 mt-2">
            <MapPin className="h-4 w-4 text-sky-500" />
            <p className="text-sm text-slate-500">
              {pool.neighborhood}, {pool.city}
            </p>
          </div>
        </div>

        {/* Share Button */}
        <ShareButton poolTitle={pool.title} poolUrl={poolUrl} />

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

      {/* Checkout Modal */}
      <CheckoutModal
        pool={pool}
        ownerWhatsapp={ownerWhatsapp}
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
