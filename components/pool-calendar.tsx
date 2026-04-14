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
    <section id="calendar" className="scroll-mt-20 space-y-4">
      {/* Calendar Card */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
        {/* Section header */}
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-sm">
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
                <h2 className="font-bold text-slate-800 text-[15px]">
                  Escolha sua data
                </h2>
                <p className="text-[11px] text-slate-400 mt-px">
                  Toque em um dia disponível
                </p>
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

        {/* Calendar body */}
        <div className="px-2 sm:px-4 pb-3">
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
              root: "w-full",
              months: "flex flex-col",
              month: "space-y-1",
              month_caption:
                "flex items-center justify-between px-2 py-2 mb-1",
              caption_label:
                "text-base font-extrabold text-slate-800 capitalize",
              nav: "flex items-center gap-1",
              button_previous:
                "inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-600 transition-all active:scale-90 border border-slate-200 hover:border-sky-200",
              button_next:
                "inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-600 transition-all active:scale-90 border border-slate-200 hover:border-sky-200",
              weekdays: "flex",
              weekday:
                "flex-1 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wide py-2",
              week: "flex",
              day: "flex-1 text-center p-[1.5px]",
              day_button:
                "w-full aspect-square rounded-lg text-[13px] font-semibold transition-all duration-150 relative flex flex-col items-center justify-center gap-0 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30 aria-selected:bg-sky-500 aria-selected:text-white aria-selected:shadow-md aria-selected:shadow-sky-400/30 aria-selected:ring-2 aria-selected:ring-sky-400/20 aria-selected:ring-offset-1",
              disabled:
                "opacity-25 cursor-not-allowed hover:bg-transparent",
              today: "font-black text-sky-600 ring-1 ring-sky-200 rounded-lg",
              selected: "",
              outside: "text-slate-300",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? (
                  <ChevronLeft className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                ),
              DayButton: (props: DayButtonProps) => {
                const dateStr = format(props.day.date, "yyyy-MM-dd");
                const weather = weatherMap.get(dateStr);
                const status = bookingStatuses.get(dateStr);
                const isPast = isBefore(props.day.date, today);
                const isDisabled = isPast || status === "confirmed";
                const isNegotiating = status === "negotiating";
                const isWknd = isWeekend(props.day.date);

                let bgClass = "";
                if (isNegotiating) {
                  bgClass =
                    "!bg-amber-50 !text-amber-800 border border-amber-200/80 cursor-not-allowed hover:!bg-amber-50";
                } else if (status === "confirmed") {
                  bgClass =
                    "!bg-slate-50 !text-slate-300 line-through cursor-not-allowed hover:!bg-slate-50";
                } else if (isWknd && !isPast) {
                  bgClass = "bg-orange-50/60";
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
                      <span className="text-[8px] leading-none opacity-50 mt-0.5">
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
        <div className="px-4 sm:px-5 pb-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-2.5 px-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span className="text-[10px] text-slate-500 font-medium">
                Disponível
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-[10px] text-slate-500 font-medium">
                Negociando
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="text-[10px] text-slate-500 font-medium">
                Reservado
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-200" />
              <span className="text-[10px] text-slate-500 font-medium">
                Fim de semana
              </span>
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

      {/* ===== Selected Date Summary + Split Calculator ===== */}
      {selectedDate && currentPrice !== null && (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
          <div className="p-4 sm:p-5">
            {/* Date + Price */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  Data selecionada
                </p>
                <p className="text-[15px] font-bold text-slate-800 capitalize mt-0.5 leading-snug">
                  {format(selectedDate, "EEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                {isWeekend(selectedDate) && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    Fim de semana
                  </span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  Preço
                </p>
                <p className="text-2xl font-black text-sky-600 mt-0.5 leading-none">
                  R$ {currentPrice}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">/dia</p>
              </div>
            </div>

            {/* Split Calculator */}
            <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <span className="text-[13px] text-slate-600 font-medium">
                    Dividir por quantos?
                  </span>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={30}
                  value={splitCount}
                  onChange={(e) => setSplitCount(e.target.value)}
                  placeholder="—"
                  className="w-16 h-9 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-300 focus:ring-2 focus:ring-purple-50 outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              {splitValue && (
                <div className="mt-3 py-2.5 rounded-xl bg-purple-50/80 border border-purple-100 text-center animate-in fade-in-50 duration-200">
                  <span className="text-lg font-black text-purple-600">
                    R$ {splitValue}
                  </span>
                  <span className="text-xs text-purple-400 ml-1">
                    por pessoa
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
