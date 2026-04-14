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

  useEffect(() => {
    async function loadWeather() {
      setLoadingWeather(true);
      const data = await fetchWeather();
      setWeatherMap(createWeatherMap(data));
      setLoadingWeather(false);
    }
    loadWeather();
  }, []);

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

  const disabledDays = useCallback(
    (date: Date) => {
      if (isBefore(date, today)) return true;
      const dateStr = format(date, "yyyy-MM-dd");
      const status = bookingStatuses.get(dateStr);
      return status === "confirmed";
    },
    [today, bookingStatuses]
  );

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

  const splitValue = useMemo(() => {
    const count = parseInt(splitCount);
    if (!currentPrice || !count || count < 2) return null;
    return Math.ceil(currentPrice / count);
  }, [currentPrice, splitCount]);

  return (
    <section id="calendar" className="scroll-mt-20 space-y-3">
      {/* ===== CALENDAR CARD ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400">
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
              <h2 className="font-bold text-slate-800 text-sm">
                Escolha sua data
              </h2>
              <p className="text-[10px] text-slate-400">
                Toque em um dia disponível
              </p>
            </div>
          </div>
          {loadingWeather && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50">
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
              <span className="text-[9px] text-slate-400">Clima...</span>
            </div>
          )}
        </div>

        {/* DayPicker — the nav is relative-positioned inside the month container */}
        <div className="px-2 sm:px-3 pb-3 pool-calendar-wrapper">
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
              month: "relative",
              month_caption:
                "flex items-center justify-center h-11 relative z-10",
              caption_label:
                "text-sm font-bold text-slate-700 capitalize",
              nav: "absolute top-0 left-0 right-0 h-11 flex items-center justify-between px-1 z-20 pointer-events-none",
              button_previous:
                "pointer-events-auto inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600 transition-all active:scale-90 border border-slate-200",
              button_next:
                "pointer-events-auto inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600 transition-all active:scale-90 border border-slate-200",
              weekdays: "flex mt-1",
              weekday:
                "flex-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1.5",
              week: "flex",
              day: "flex-1 text-center p-px",
              day_button:
                "w-full aspect-square rounded-lg text-[13px] font-semibold transition-all duration-100 relative flex flex-col items-center justify-center hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300/40 aria-selected:bg-sky-500 aria-selected:text-white aria-selected:shadow-md aria-selected:shadow-sky-400/30",
              disabled:
                "opacity-25 cursor-not-allowed hover:bg-transparent",
              today: "font-black text-sky-600 ring-1 ring-sky-200",
              selected: "",
              outside: "text-slate-200",
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
                const isWknd = isWeekend(props.day.date);

                let cellClass = "";
                if (isNegotiating) {
                  cellClass =
                    "!bg-amber-50 !text-amber-700 border border-amber-200 cursor-not-allowed hover:!bg-amber-50";
                } else if (status === "confirmed") {
                  cellClass =
                    "!bg-slate-50 !text-slate-300 line-through cursor-not-allowed hover:!bg-slate-50";
                } else if (isWknd && !isPast) {
                  cellClass = "bg-orange-50/50";
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
                    className={`${props.className ?? ""} ${cellClass}`}
                  >
                    <span className="text-[13px] leading-none">
                      {props.day.date.getDate()}
                    </span>

                    {weather && !isPast && (
                      <span className="text-[7px] leading-none opacity-50 mt-0.5">
                        {getWeatherIcon(weather.weatherCode)}{" "}
                        {weather.temperatureMax}°
                      </span>
                    )}

                    {isNegotiating && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ring-1 ring-white"
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
        <div className="px-3 pb-3">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 px-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-sky-400" />
              <span className="text-slate-500">Disponível</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-500">Negociando</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-slate-500">Reservado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-200" />
              <span className="text-slate-500">Fim de semana</span>
            </div>
            {!loadingWeather && (
              <div className="flex items-center gap-0.5">
                <span>☀️</span>
                <span className="text-slate-400">14d</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== SELECTED DATE SUMMARY ===== */}
      {selectedDate && currentPrice !== null && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 duration-200">
          <div className="p-4">
            {/* Date + Price — stacks on tiny screens, row on sm+ */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Data selecionada
                </p>
                <p className="text-[14px] font-bold text-slate-800 capitalize mt-0.5 leading-snug">
                  {format(selectedDate, "EEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                {isWeekend(selectedDate) && (
                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-px rounded text-[9px] font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-300" />
                    Fim de semana
                  </span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Preço
                </p>
                <p className="text-xl font-black text-sky-600 mt-0.5 leading-none">
                  R$ {currentPrice}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">/dia</p>
              </div>
            </div>

            {/* Split Calculator */}
            <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-[12px] text-slate-500 font-medium">
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
                  className="w-14 h-8 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg focus:border-purple-300 focus:ring-1 focus:ring-purple-100 outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              {splitValue && (
                <div className="mt-2 py-2 rounded-lg bg-purple-50 border border-purple-100 text-center animate-in fade-in-50 duration-150">
                  <span className="text-base font-black text-purple-600">
                    R$ {splitValue}
                  </span>
                  <span className="text-[11px] text-purple-400 ml-1">
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
