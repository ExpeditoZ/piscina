"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import {
  format,
  isBefore,
  startOfDay,
  isWeekend,
  addMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  fetchWeather,
  getWeatherIcon,
  createWeatherMap,
} from "@/lib/weather";
import type { Pricing, WeatherDay, BookingCalendar } from "@/lib/types";

interface PoolCalendarProps {
  poolId: string;
  pricing: Pricing;
  onDateSelect: (date: Date, price: number) => void;
}

type BookingStatusMap = Map<string, "negotiating" | "confirmed">;

export function PoolCalendar({
  poolId,
  pricing,
  onDateSelect,
}: PoolCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [bookingStatuses, setBookingStatuses] = useState<BookingStatusMap>(
    new Map()
  );
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherDay>>(
    new Map()
  );
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [splitCount, setSplitCount] = useState<string>("");

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = addMonths(today, 3);

  // ----- Fetch weather data -----
  useEffect(() => {
    async function loadWeather() {
      setLoadingWeather(true);
      const data = await fetchWeather();
      setWeatherMap(createWeatherMap(data));
      setLoadingWeather(false);
    }
    loadWeather();
  }, []);

  // ----- Fetch initial bookings -----
  useEffect(() => {
    async function loadBookings() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("calendar_bookings")
        .select("booking_date, status")
        .eq("pool_id", poolId);

      if (error) {
        console.error("Error loading bookings:", error);
        return;
      }

      const map: BookingStatusMap = new Map();
      (data as BookingCalendar[])?.forEach((b) => {
        if (b.status === "cancelled") return;
        const existing = map.get(b.booking_date);
        if (!existing || b.status === "confirmed") {
          map.set(b.booking_date, b.status as "negotiating" | "confirmed");
        }
      });
      setBookingStatuses(map);
    }

    loadBookings();
  }, [poolId]);

  // ----- Supabase Realtime subscription -----
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`bookings-${poolId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          const booking = payload.new as BookingCalendar & {
            pool_id: string;
          };

          if (!booking?.booking_date) return;

          setBookingStatuses((prev) => {
            const next = new Map(prev);

            if (
              payload.eventType === "DELETE" ||
              booking.status === "cancelled"
            ) {
              next.delete(booking.booking_date);
            } else {
              next.set(
                booking.booking_date,
                booking.status as "negotiating" | "confirmed"
              );
            }

            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolId]);

  // ----- Date click handler (selection only — NO checkout) -----
  const handleDateClick = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const status = bookingStatuses.get(dateStr);

      if (status === "confirmed") {
        toast.error("Esta data já está reservada.");
        return;
      }

      if (status === "negotiating") {
        toast.warning("Alguém está negociando esta data! 🔥", {
          description: "Aguarde ou escolha outra data disponível.",
        });
        return;
      }

      const price = isWeekend(date) ? pricing.weekend : pricing.weekday;
      setSelectedDate(date);
      setCurrentPrice(price);
      // Notify parent of selection (without opening checkout)
      onDateSelect(date, price);
    },
    [bookingStatuses, pricing, onDateSelect]
  );

  // ----- Disabled days -----
  const disabledDays = useCallback(
    (date: Date) => {
      if (isBefore(date, today)) return true;
      const dateStr = format(date, "yyyy-MM-dd");
      const status = bookingStatuses.get(dateStr);
      return status === "confirmed";
    },
    [today, bookingStatuses]
  );

  // ----- Day modifiers -----
  const modifiers = useMemo(() => {
    const negotiating: Date[] = [];
    const confirmed: Date[] = [];

    bookingStatuses.forEach((status, dateStr) => {
      const date = new Date(dateStr + "T12:00:00");
      if (status === "negotiating") negotiating.push(date);
      if (status === "confirmed") confirmed.push(date);
    });

    return { negotiating, confirmed };
  }, [bookingStatuses]);

  // ----- Split calculator -----
  const splitValue = useMemo(() => {
    const count = parseInt(splitCount);
    if (!currentPrice || !count || count < 2) return null;
    return Math.ceil(currentPrice / count);
  }, [currentPrice, splitCount]);

  return (
    <section id="calendar" className="scroll-mt-20 space-y-0">
      {/* Calendar Card */}
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 overflow-hidden border border-slate-100/80">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-md shadow-sky-200/50">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-base">
                  Escolha sua data
                </h2>
                <p className="text-[11px] text-slate-400">Selecione para ver o preço</p>
              </div>
            </div>
            {loadingWeather && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50">
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                <span className="text-[10px] text-slate-400">Clima...</span>
              </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="px-3 sm:px-5 pb-2 flex justify-center">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && handleDateClick(date)}
            locale={ptBR}
            disabled={disabledDays}
            fromDate={today}
            toDate={maxDate}
            showOutsideDays={false}
            modifiers={modifiers}
            modifiersClassNames={{
              negotiating: "pool-cal-negotiating",
              confirmed: "pool-cal-confirmed",
            }}
            classNames={{
              root: "w-full max-w-[380px]",
              months: "flex flex-col",
              month: "space-y-2",
              month_caption:
                "flex justify-center pt-1 relative items-center h-12",
              caption_label:
                "text-sm font-bold text-slate-800 capitalize tracking-wide",
              nav: "flex items-center justify-between absolute inset-x-0 px-1",
              button_previous:
                "p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all active:scale-95 border border-slate-100",
              button_next:
                "p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all active:scale-95 border border-slate-100",
              weekdays: "flex",
              weekday:
                "flex-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2",
              week: "flex mt-0.5",
              day: "flex-1 text-center p-[2px]",
              day_button:
                "w-full aspect-square rounded-xl text-sm font-semibold transition-all duration-150 relative flex flex-col items-center justify-center gap-0 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30 aria-selected:bg-gradient-to-br aria-selected:from-sky-500 aria-selected:to-cyan-500 aria-selected:text-white aria-selected:shadow-lg aria-selected:shadow-sky-300/50 aria-selected:scale-[1.05]",
              disabled:
                "opacity-30 cursor-not-allowed hover:bg-transparent",
              today: "font-black text-sky-600",
              selected: "",
              outside: "text-slate-300",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                ),
              DayButton: (props: DayButtonProps) => {
                const dateStr = format(props.day.date, "yyyy-MM-dd");
                const weather = weatherMap.get(dateStr);
                const status = bookingStatuses.get(dateStr);
                const isPast = isBefore(props.day.date, today);
                const isDisabled = isPast || status === "confirmed";
                const isNegotiating = status === "negotiating";

                let bgClass = "";
                if (isNegotiating) {
                  bgClass =
                    "!bg-amber-50 !text-amber-700 border border-amber-200 cursor-not-allowed hover:!bg-amber-50";
                } else if (status === "confirmed") {
                  bgClass =
                    "!bg-slate-50 !text-slate-300 line-through cursor-not-allowed hover:!bg-slate-50";
                }

                return (
                  <button
                    {...props}
                    disabled={isDisabled}
                    onClick={(e) => {
                      if (isNegotiating) {
                        e.preventDefault();
                        toast.warning(
                          "Alguém está negociando esta data! 🔥",
                          {
                            description:
                              "Aguarde ou escolha outra data disponível.",
                          }
                        );
                        return;
                      }
                      props.onClick?.(e);
                    }}
                    className={`${props.className ?? ""} ${bgClass}`}
                  >
                    <span className="text-[13px] leading-none">
                      {props.day.date.getDate()}
                    </span>

                    {weather && !isPast && (
                      <span className="text-[8px] leading-none opacity-60 mt-px">
                        {getWeatherIcon(weather.weatherCode)}{" "}
                        {weather.temperatureMax}°
                      </span>
                    )}

                    {isNegotiating && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-2 ring-white"
                        title="Em negociação"
                      />
                    )}
                  </button>
                );
              },
            }}
          />
        </div>

        {/* Legend */}
        <div className="px-5 pb-4">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 py-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-sky-400 to-cyan-400 shadow-sm" />
              <span className="text-[10px] text-slate-500 font-medium">Disponível</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-300 shadow-sm" />
              <span className="text-[10px] text-slate-500 font-medium">Negociando</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="text-[10px] text-slate-500 font-medium">Reservado</span>
            </div>
            {!loadingWeather && (
              <div className="flex items-center gap-1">
                <span className="text-[10px]">☀️</span>
                <span className="text-[10px] text-slate-400">14 dias</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Date Summary Card */}
      {selectedDate && currentPrice !== null && (
        <div className="mt-4 bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-100/80 overflow-hidden animate-in fade-in-50 slide-in-from-bottom-3 duration-300">
          {/* Color accent bar */}
          <div className="h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400" />

          <div className="p-5">
            {/* Date + Price row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                  Data selecionada
                </p>
                <p className="text-sm font-bold text-slate-800 capitalize">
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-sky-600">
                    R$ {currentPrice}
                  </span>
                </div>
                {isWeekend(selectedDate) ? (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">
                    FIM DE SEMANA
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">/dia</span>
                )}
              </div>
            </div>

            {/* Split Calculator */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="p-1.5 rounded-lg bg-purple-50">
                    <Users className="h-3.5 w-3.5 text-purple-500" />
                  </div>
                  <label className="text-xs text-slate-500 font-medium whitespace-nowrap">
                    Dividir por quantos?
                  </label>
                </div>
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={splitCount}
                  onChange={(e) => setSplitCount(e.target.value)}
                  placeholder="Ex: 5"
                  className="w-20 h-9 px-3 text-sm text-center font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
              </div>

              {splitValue && (
                <div className="mt-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-100 animate-in fade-in-50 duration-200">
                  <p className="text-center">
                    <span className="text-lg font-black text-purple-600">
                      R$ {splitValue}
                    </span>
                    <span className="text-xs text-purple-400 ml-1.5">
                      por pessoa
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
