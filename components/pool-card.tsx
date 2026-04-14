"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import type { PoolPublic } from "@/lib/types";

interface PoolCardProps {
  pool: PoolPublic;
}

export function PoolCard({ pool }: PoolCardProps) {
  const basePrice = Math.min(pool.pricing.weekday, pool.pricing.weekend);
  const mainPhoto = pool.photos?.[0];

  return (
    <Link
      href={`/pool/${pool.id}`}
      id={`pool-card-${pool.id}`}
      className="group block rounded-2xl overflow-hidden bg-white shadow-md shadow-slate-200/60 hover:shadow-xl hover:shadow-sky-200/40 transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-sky-100 to-cyan-50">
        {mainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainPhoto}
            alt={pool.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🏊</div>
              <p className="text-xs text-sky-400">Sem fotos</p>
            </div>
          </div>
        )}

        {/* Photo count badge */}
        {pool.photos && pool.photos.length > 1 && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium">
            📷 {pool.photos.length}
          </span>
        )}

        {/* Price badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-lg text-xs font-bold text-slate-800">
            R$ {basePrice}
            <span className="text-[10px] font-normal text-slate-500">/dia</span>
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-sky-600 transition-colors">
          {pool.title}
        </h3>
        <div className="flex items-center gap-1 mt-1.5">
          <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-500 line-clamp-1">
            {pool.neighborhood}, {pool.city}
          </p>
        </div>

        {/* Features hints */}
        <div className="flex items-center gap-2 mt-3">
          {pool.shifts_config?.enabled && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium border border-amber-100">
              ⏰ Turnos
            </span>
          )}
          {pool.upsell_extras && pool.upsell_extras.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-medium border border-purple-100">
              🛒 Extras
            </span>
          )}
          {pool.rules && (
            <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-medium border border-slate-100">
              📋 Regras
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
