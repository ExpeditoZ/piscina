"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Navigation, ChevronDown, X, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Region, City } from "@/lib/types";

interface CityWithRegion extends City {
  region_name?: string;
  region_slug?: string;
}

interface CitySelectorProps {
  currentCitySlug?: string | null;
  compact?: boolean;
}

export function CitySelector({ currentCitySlug, compact }: CitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [regions, setRegions] = useState<(Region & { cities: City[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [currentCity, setCurrentCity] = useState<string | null>(null);

  // Resolve current city name from slug
  useEffect(() => {
    if (!currentCitySlug) {
      setCurrentCity(null);
      return;
    }
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("cities")
        .select("name")
        .eq("slug", currentCitySlug)
        .maybeSingle();
      if (data) setCurrentCity(data.name);
    })();
  }, [currentCitySlug]);

  // Load regions + cities when opened
  const loadData = useCallback(async () => {
    if (regions.length > 0) return;
    setLoading(true);
    const sb = createClient();

    const { data: regionsData } = await sb
      .from("regions")
      .select("*")
      .order("sort_order");

    const { data: citiesData } = await sb
      .from("cities")
      .select("*")
      .order("name");

    if (regionsData && citiesData) {
      const grouped = regionsData.map((r: Region) => ({
        ...r,
        cities: citiesData.filter((c: City) => c.region_id === r.id),
      }));
      setRegions(grouped);
    }

    setLoading(false);
  }, [regions.length]);

  function selectCity(citySlug: string) {
    // Set cookie and reload
    document.cookie = `preferred_city=${citySlug};path=/;max-age=${60 * 60 * 24 * 365}`;
    window.location.href = `/?city=${citySlug}`;
  }

  function clearCity() {
    document.cookie = "preferred_city=;path=/;max-age=0";
    window.location.href = "/";
  }

  async function detectLocation() {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Find nearest city from our cities table
        const sb = createClient();
        const { data: cities } = await sb.from("cities").select("*");

        if (cities && cities.length > 0) {
          let nearest = cities[0];
          let minDist = Infinity;

          for (const city of cities) {
            if (city.latitude && city.longitude) {
              const d = haversine(latitude, longitude, city.latitude, city.longitude);
              if (d < minDist) {
                minDist = d;
                nearest = city;
              }
            }
          }

          selectCity(nearest.slug);
        }

        setDetectingLocation(false);
      },
      () => {
        setDetectingLocation(false);
      },
      { timeout: 10000 }
    );
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(true);
          loadData();
        }}
        className={`flex items-center gap-1.5 transition-colors ${
          compact
            ? "px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
            : "px-3 py-1.5 text-sm rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200"
        }`}
      >
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate max-w-[120px]">
          {currentCity ?? "Selecionar cidade"}
        </span>
        <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Escolha sua cidade</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* GPS button */}
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={detectLocation}
                disabled={detectingLocation}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sm text-sky-700 font-medium transition-colors disabled:opacity-50"
              >
                {detectingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                Usar minha localização
              </button>
            </div>

            {/* Clear selection */}
            {currentCitySlug && (
              <div className="px-4 pt-2">
                <button
                  onClick={clearCity}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-xs text-slate-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Ver todas as cidades
                </button>
              </div>
            )}

            {/* Regions + Cities list */}
            <div className="overflow-y-auto max-h-[50vh] px-4 py-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
              ) : (
                regions.map((region) => (
                  <div key={region.id} className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                      {region.name}
                    </p>
                    <div className="space-y-0.5">
                      {region.cities.map((city) => {
                        const isSelected = city.slug === currentCitySlug;
                        return (
                          <button
                            key={city.id}
                            onClick={() => selectCity(city.slug)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                              isSelected
                                ? "bg-sky-50 text-sky-700 font-semibold"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span>{city.name}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-sky-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Haversine formula for distance in km
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
