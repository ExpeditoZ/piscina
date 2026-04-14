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
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = addMonths(today, 3); // Show 3 months ahead

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
        if (b.status === "cancelled") return; // skip cancelled
        const existing = map.get(b.booking_date);
        // confirmed takes priority over negotiating
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

  // ----- Date click handler -----
  const handleDateClick = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const status = bookingStatuses.get(dateStr);

      if (status === "confirmed") {
        toast.error("Esta data já está reservada.");
        return;
      }

      if (status === "negotiating") {
        toast.warning("Alguém está negociando esta data! 🔥");
        return;
      }

      const price = isWeekend(date) ? pricing.weekend : pricing.weekday;
      setSelectedDate(date);
      setCurrentPrice(price);
      onDateSelect(date, price);
    },
    [bookingStatuses, pricing, onDateSelect]
  );

  // ----- Disabled days (past + booked) -----
  const disabledDays = useCallback(
    (date: Date) => {
      if (isBefore(date, today)) return true;

      const dateStr = format(date, "yyyy-MM-dd");
      const status = bookingStatuses.get(dateStr);
      return status === "confirmed";
    },
    [today, bookingStatuses]
  );

  // ----- Day modifiers for coloring -----
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

  return (
    <Card id="calendar" className="border-0 shadow-lg shadow-sky-100/50 bg-white overflow-hidden scroll-mt-20">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
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
            <h2 className="font-semibold text-slate-800 text-sm sm:text-base">
              Escolha sua data
            </h2>
            {loadingWeather && (
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Carregando clima...
              </p>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex justify-center [--cell-size:theme(spacing.11)] sm:[--cell-size:theme(spacing.12)]">
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
              root: "w-full max-w-[360px]",
              months: "flex flex-col",
              month: "space-y-3",
              month_caption: "flex justify-center pt-1 relative items-center h-10",
              caption_label: "text-sm font-semibold text-slate-800 capitalize",
              nav: "flex items-center justify-between absolute inset-x-0",
              button_previous:
                "p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors",
              button_next:
                "p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors",
              weekdays: "flex",
              weekday:
                "flex-1 text-center text-[11px] font-medium text-slate-400 uppercase py-2",
              week: "flex mt-1",
              day: "flex-1 text-center p-0.5",
              day_button:
                "w-full aspect-square rounded-xl text-sm font-medium transition-all duration-150 relative flex flex-col items-center justify-center gap-0 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400/40 aria-selected:bg-sky-500 aria-selected:text-white aria-selected:shadow-md aria-selected:shadow-sky-300/40",
              disabled:
                "opacity-40 cursor-not-allowed hover:bg-transparent",
              today: "font-bold text-sky-600",
              selected: "!bg-sky-500 !text-white shadow-md shadow-sky-300/40",
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

                // Determine background styles
                let bgClass = "";
                if (isNegotiating) {
                  bgClass =
                    "!bg-amber-100 !text-amber-700 border-2 border-amber-300 cursor-not-allowed hover:!bg-amber-100";
                } else if (status === "confirmed") {
                  bgClass =
                    "!bg-slate-100 !text-slate-400 line-through cursor-not-allowed hover:!bg-slate-100";
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

                    {/* Weather info for next 14 days */}
                    {weather && !isPast && (
                      <span className="text-[9px] leading-none opacity-70">
                        {getWeatherIcon(weather.weatherCode)}{" "}
                        {weather.temperatureMax}°
                      </span>
                    )}

                    {/* Status indicator */}
                    {isNegotiating && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse"
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
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-sky-50 border border-sky-200" />
            <span className="text-[10px] text-slate-500">Disponível</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
            <span className="text-[10px] text-slate-500">Em negociação</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-300" />
            <span className="text-[10px] text-slate-500">Reservado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">☀️</span>
            <span className="text-[10px] text-slate-500">Clima 14 dias</span>
          </div>
        </div>

        {/* Dynamic Price Display */}
        {selectedDate && currentPrice !== null && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-100 text-center animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <p className="text-xs text-slate-500 mb-1">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              {isWeekend(selectedDate) && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                  FIM DE SEMANA
                </span>
              )}
            </p>
            <p className="text-2xl font-bold text-sky-600">
              R$ {currentPrice}
              <span className="text-sm font-normal text-slate-400 ml-1">
                /dia
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
