"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DayPicker,
  type DayButtonProps,
  type MonthCaptionProps,
  useDayPicker,
} from "react-day-picker";
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

/* =============================================
   Custom MonthCaption with nav buttons
   ============================================= */
function CustomMonthCaption({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();

  return (
    <div className="flex items-center justify-between px-1 h-12 mb-2">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-sky-50 hover:text-sky-600 active:scale-95 transition-colors disabled:opacity-20"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <span className="text-base font-extrabold text-slate-800 capitalize tracking-tight">
        {format(calendarMonth.date, "LLLL yyyy", { locale: ptBR })}
      </span>

      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-sky-50 hover:text-sky-600 active:scale-95 transition-colors disabled:opacity-20"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

/* =============================================
   Pool Calendar
   ============================================= */
interface PoolCalendarProps {
  poolId: string;
  pricing: Pricing;
  onDateSelect: (date: Date, price: number) => void;
}

type BookingStatusMap = Map<string, "negotiating" | "confirmed">;

export function PoolCalendar({ poolId, pricing, onDateSelect }: PoolCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [bookingStatuses, setBookingStatuses] = useState<BookingStatusMap>(new Map());
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherDay>>(new Map());
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [splitCount, setSplitCount] = useState("");

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = addMonths(today, 3);

  useEffect(() => {
    (async () => {
      setLoadingWeather(true);
      const data = await fetchWeather();
      setWeatherMap(createWeatherMap(data));
      setLoadingWeather(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("calendar_bookings")
        .select("booking_date, status")
        .eq("pool_id", poolId);
      if (error) return;
      const map: BookingStatusMap = new Map();
      (data as BookingCalendar[])?.forEach((b) => {
        if (b.status === "cancelled") return;
        const existing = map.get(b.booking_date);
        if (!existing || b.status === "confirmed") {
          map.set(b.booking_date, b.status as "negotiating" | "confirmed");
        }
      });
      setBookingStatuses(map);
    })();
  }, [poolId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bookings-${poolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `pool_id=eq.${poolId}` },
        (payload) => {
          const booking = payload.new as BookingCalendar & { pool_id: string };
          if (!booking?.booking_date) return;
          setBookingStatuses((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "DELETE" || booking.status === "cancelled") {
              next.delete(booking.booking_date);
            } else {
              next.set(booking.booking_date, booking.status as "negotiating" | "confirmed");
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      return bookingStatuses.get(format(date, "yyyy-MM-dd")) === "confirmed";
    },
    [today, bookingStatuses]
  );

  const modifiers = useMemo(() => {
    const negotiating: Date[] = [];
    const confirmed: Date[] = [];
    bookingStatuses.forEach((status, dateStr) => {
      const d = new Date(dateStr + "T12:00:00");
      if (status === "negotiating") negotiating.push(d);
      if (status === "confirmed") confirmed.push(d);
    });
    return { negotiating, confirmed };
  }, [bookingStatuses]);

  const splitValue = useMemo(() => {
    const n = parseInt(splitCount);
    if (!currentPrice || !n || n < 2) return null;
    return Math.ceil(currentPrice / n);
  }, [currentPrice, splitCount]);

  return (
    <section id="calendar" className="scroll-mt-16 space-y-3">
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-[15px]">Escolha sua data</h2>
              <p className="text-[10px] text-slate-400 mt-px">Toque em um dia disponível</p>
            </div>
          </div>
          {loadingWeather && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
        </div>

        {/* Calendar — fills the card, no narrow max-w constraint */}
        <div className="px-3 sm:px-4 pb-3">
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
            classNames={{
              root: "w-full",
              months: "flex flex-col",
              month: "",
              nav: "hidden",
              month_caption: "",
              caption_label: "hidden",
              weekdays: "flex border-b border-slate-100 mb-1",
              weekday: "flex-1 text-center text-[11px] font-bold text-slate-400 uppercase py-2",
              week: "flex",
              day: "flex-1 text-center p-[2px]",
              day_button:
                "w-full aspect-square rounded-xl text-sm font-semibold relative flex flex-col items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 aria-selected:bg-sky-500 aria-selected:text-white aria-selected:font-bold aria-selected:shadow-md aria-selected:shadow-sky-300/40",
              disabled: "cursor-not-allowed",
              today: "font-extrabold",
              selected: "",
              outside: "text-slate-200",
            }}
            components={{
              MonthCaption: CustomMonthCaption,
              DayButton: (props: DayButtonProps) => {
                const dateStr = format(props.day.date, "yyyy-MM-dd");
                const weather = weatherMap.get(dateStr);
                const status = bookingStatuses.get(dateStr);
                const isPast = isBefore(props.day.date, today);
                const isDisabled = isPast || status === "confirmed";
                const isNegotiating = status === "negotiating";
                const isConfirmed = status === "confirmed";
                const isWknd = isWeekend(props.day.date);
                const isToday = dateStr === format(today, "yyyy-MM-dd");
                const isSelected = selectedDate && dateStr === format(selectedDate, "yyyy-MM-dd");

                /*
                  VISUAL STATE SYSTEM — every cell gets a clear bg + text treatment:
                  1. Past         → faded, no interaction
                  2. Confirmed    → red bg, line-through, red dot
                  3. Negotiating  → amber bg, bold, pulsing dot
                  4. Selected     → handled by aria-selected (sky-500)
                  5. Weekend      → warm orange tint
                  6. Available    → green tint to positively show availability
                  7. Today        → sky ring
                */
                let cellClass = "";
                let dotColor = "";

                if (isPast) {
                  cellClass = "bg-slate-50 text-slate-300 hover:bg-slate-50";
                } else if (isConfirmed) {
                  cellClass = "bg-red-50 text-red-300 line-through hover:bg-red-50 border border-red-200";
                  dotColor = "bg-red-400";
                } else if (isNegotiating) {
                  cellClass = "bg-amber-50 text-amber-700 font-bold hover:bg-amber-50 border border-amber-300";
                  dotColor = "bg-amber-500";
                } else if (isSelected) {
                  // aria-selected handles this
                  cellClass = "";
                } else if (isWknd) {
                  cellClass = "bg-orange-50 text-slate-700 hover:bg-orange-100";
                } else {
                  // Available weekday — positive green tint
                  cellClass = "bg-emerald-50/60 text-slate-700 hover:bg-emerald-100";
                }

                // Today ring (unless selected)
                if (isToday && !isSelected) {
                  cellClass += " ring-2 ring-sky-400 ring-inset";
                }

                return (
                  <button
                    {...props}
                    disabled={isDisabled}
                    onClick={(e) => {
                      if (isNegotiating) {
                        e.preventDefault();
                        toast.warning("Alguém está negociando esta data! 🔥", {
                          description: "Aguarde ou escolha outra data disponível.",
                        });
                        return;
                      }
                      props.onClick?.(e);
                    }}
                    className={`${props.className ?? ""} ${cellClass}`}
                  >
                    <span className="leading-none">{props.day.date.getDate()}</span>

                    {weather && !isPast && !isConfirmed && (
                      <span className="text-[7px] leading-none opacity-50 mt-0.5">
                        {getWeatherIcon(weather.weatherCode)} {weather.temperatureMax}°
                      </span>
                    )}

                    {dotColor && (
                      <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${dotColor} ${isNegotiating ? "animate-pulse" : ""} ring-1 ring-white`} />
                    )}
                  </button>
                );
              },
            }}
          />
        </div>

        {/* Legend — uses mini cell mockups */}
        <div className="px-3 sm:px-4 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-50/60">
              <span className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[10px] text-slate-600 font-semibold">12</span>
              <span className="text-slate-600 font-medium">Disponível</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-50">
              <span className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-center text-[10px] text-amber-800 font-bold relative">
                8
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
              </span>
              <span className="text-slate-600 font-medium">Negociando</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-50">
              <span className="w-6 h-6 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-[10px] text-red-300 line-through font-semibold relative">
                3
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />
              </span>
              <span className="text-slate-600 font-medium">Reservado</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-orange-50">
              <span className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[10px] text-slate-600 font-semibold">S</span>
              <span className="text-slate-600 font-medium">Fim de semana</span>
            </div>
          </div>
        </div>

        {/* Selected date + split calculator */}
        {selectedDate && currentPrice !== null && (
          <div className="border-t border-slate-100 px-4 py-3 bg-sky-50/40 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Data selecionada</p>
                <p className="text-[14px] font-bold text-slate-800 capitalize mt-0.5">
                  {format(selectedDate, "EEE, d 'de' MMMM", { locale: ptBR })}
                  {isWeekend(selectedDate) && (
                    <span className="ml-1 text-[9px] font-semibold text-orange-600 bg-orange-100 px-1 py-px rounded">FDS</span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-black text-sky-600">R$ {currentPrice}</p>
                <p className="text-[9px] text-slate-400">/dia</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <span className="text-[13px] text-slate-500 font-medium">Dividir por quantos?</span>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={30}
                  value={splitCount}
                  onChange={(e) => setSplitCount(e.target.value)}
                  placeholder="—"
                  className="w-16 h-9 text-center text-sm font-bold bg-white border border-slate-200 rounded-lg focus:border-purple-300 focus:ring-1 focus:ring-purple-100 outline-none transition-all placeholder:text-slate-300"
                />
              </div>
              {splitValue && (
                <div className="mt-2.5 py-2.5 rounded-lg bg-purple-50 text-center animate-in fade-in-50 duration-150">
                  <span className="text-lg font-black text-purple-600">R$ {splitValue}</span>
                  <span className="text-[11px] text-purple-400 ml-1">por pessoa</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
