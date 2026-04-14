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
   Month nav bar: ◀  Abril 2026  ▶
   ============================================= */
function MonthNav({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();
  return (
    <div className="flex items-center justify-between h-12 px-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        aria-label="Mês anterior"
        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600 inline-flex items-center justify-center active:scale-95 transition-colors disabled:opacity-20"
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
        aria-label="Próximo mês"
        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600 inline-flex items-center justify-center active:scale-95 transition-colors disabled:opacity-20"
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

  useEffect(() => { (async () => { setLoadingWeather(true); const d = await fetchWeather(); setWeatherMap(createWeatherMap(d)); setLoadingWeather(false); })(); }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("calendar_bookings").select("booking_date, status").eq("pool_id", poolId);
      if (error) return;
      const map: BookingStatusMap = new Map();
      (data as BookingCalendar[])?.forEach((b) => {
        if (b.status === "cancelled") return;
        const ex = map.get(b.booking_date);
        if (!ex || b.status === "confirmed") map.set(b.booking_date, b.status as "negotiating" | "confirmed");
      });
      setBookingStatuses(map);
    })();
  }, [poolId]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`bookings-${poolId}`).on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `pool_id=eq.${poolId}` }, (payload) => {
      const b = payload.new as BookingCalendar & { pool_id: string };
      if (!b?.booking_date) return;
      setBookingStatuses((prev) => { const n = new Map(prev); if (payload.eventType === "DELETE" || b.status === "cancelled") n.delete(b.booking_date); else n.set(b.booking_date, b.status as "negotiating" | "confirmed"); return n; });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [poolId]);

  const handleDateClick = useCallback((date: Date) => {
    const ds = format(date, "yyyy-MM-dd");
    const st = bookingStatuses.get(ds);
    if (st === "confirmed") { toast.error("Esta data já está reservada."); return; }
    if (st === "negotiating") { toast.warning("Alguém está negociando esta data! 🔥", { description: "Aguarde ou escolha outra data disponível." }); return; }
    const p = isWeekend(date) ? pricing.weekend : pricing.weekday;
    setSelectedDate(date); setCurrentPrice(p); onDateSelect(date, p);
  }, [bookingStatuses, pricing, onDateSelect]);

  const disabledDays = useCallback((date: Date) => {
    if (isBefore(date, today)) return true;
    return bookingStatuses.get(format(date, "yyyy-MM-dd")) === "confirmed";
  }, [today, bookingStatuses]);

  const modifiers = useMemo(() => {
    const neg: Date[] = []; const conf: Date[] = [];
    bookingStatuses.forEach((s, ds) => { const d = new Date(ds + "T12:00:00"); if (s === "negotiating") neg.push(d); if (s === "confirmed") conf.push(d); });
    return { negotiating: neg, confirmed: conf };
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
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-[15px] leading-tight">Escolha sua data</h2>
              <p className="text-[10px] text-slate-400">Toque em um dia disponível</p>
            </div>
          </div>
          {loadingWeather && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
        </div>

        {/*
          INNER CALENDAR BLOCK
          ─────────────────────
          max-w-[440px] creates a controlled-width column.
          mx-auto centers it horizontally in the card.
          On mobile (<440px) it fills naturally.
          On desktop the card may be wider, but the calendar
          stays a centered, cohesive 440px block.
        */}
        <div className="max-w-[440px] w-full mx-auto px-4 pb-3">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && handleDateClick(d)}
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
              weekdays: "flex mb-1",
              weekday: "flex-1 text-center text-[11px] font-bold text-slate-400 uppercase py-2 border-b border-slate-100",
              week: "flex gap-[3px] mt-[3px]",
              day: "flex-1 min-w-0",
              day_button: "w-full aspect-square rounded-xl text-sm font-semibold relative flex flex-col items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
              disabled: "cursor-not-allowed",
              today: "",
              selected: "",
              outside: "invisible",
            }}
            components={{
              MonthCaption: MonthNav,
              DayButton: (props: DayButtonProps) => {
                const dateStr = format(props.day.date, "yyyy-MM-dd");
                const weather = weatherMap.get(dateStr);
                const status = bookingStatuses.get(dateStr);
                const isPast = isBefore(props.day.date, today);
                const isConfirmed = status === "confirmed";
                const isNegotiating = status === "negotiating";
                const isDisabled = isPast || isConfirmed;
                const isWknd = isWeekend(props.day.date);
                const isToday = dateStr === format(today, "yyyy-MM-dd");
                const isSel = selectedDate ? dateStr === format(selectedDate, "yyyy-MM-dd") : false;

                /*
                  STATE PRIORITY (highest to lowest):
                  1. Selected   → solid blue, white text, shadow
                  2. Past       → flat gray, muted
                  3. Confirmed  → red fill, line-through, dot
                  4. Negotiating → amber fill, bold, pulsing dot
                  5. Available   → green fill (weekday) or orange fill (weekend)
                */
                let bg = "";
                let text = "";
                let border = "";
                let extra = "";

                if (isSel) {
                  bg = "bg-sky-500"; text = "text-white"; border = ""; extra = "shadow-lg shadow-sky-300/50 scale-[1.02] z-10";
                } else if (isPast) {
                  bg = "bg-slate-100/80"; text = "text-slate-300"; border = "";
                } else if (isConfirmed) {
                  bg = "bg-red-100"; text = "text-red-400"; border = "ring-1 ring-inset ring-red-200"; extra = "line-through";
                } else if (isNegotiating) {
                  bg = "bg-amber-100"; text = "text-amber-800"; border = "ring-1 ring-inset ring-amber-300"; extra = "font-bold";
                } else if (isWknd) {
                  bg = "bg-orange-50"; text = "text-orange-800"; border = "ring-1 ring-inset ring-orange-200"; extra = "hover:bg-orange-100";
                } else {
                  // Available weekday
                  bg = "bg-emerald-50"; text = "text-emerald-800"; border = "ring-1 ring-inset ring-emerald-200"; extra = "hover:bg-emerald-100";
                }

                // Today marker
                const todayRing = isToday && !isSel ? "ring-2 ring-sky-400" : "";

                return (
                  <button
                    {...props}
                    disabled={isDisabled}
                    onClick={(e) => {
                      if (isNegotiating) { e.preventDefault(); toast.warning("Alguém está negociando esta data! 🔥", { description: "Aguarde ou escolha outra data disponível." }); return; }
                      props.onClick?.(e);
                    }}
                    className={`${props.className ?? ""} ${bg} ${text} ${border} ${extra} ${todayRing}`}
                  >
                    {/* Day number */}
                    <span className="text-sm leading-none font-semibold">{props.day.date.getDate()}</span>

                    {/* Weather — secondary info, only for available future days */}
                    {weather && !isPast && !isConfirmed && (
                      <span className={`text-[7px] leading-none mt-0.5 ${isSel ? "text-white/70" : "opacity-40"}`}>
                        {getWeatherIcon(weather.weatherCode)} {weather.temperatureMax}°
                      </span>
                    )}

                    {/* Status dots */}
                    {isNegotiating && !isSel && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-1 ring-white" />
                    )}
                    {isConfirmed && !isPast && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400 ring-1 ring-white" />
                    )}
                  </button>
                );
              },
            }}
          />

          {/* LEGEND — compact, inside the same centered wrapper */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="flex items-center gap-1.5 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-lg px-2 py-1.5">
              <span className="w-4 h-4 rounded bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center text-[8px] text-emerald-800 font-bold">✓</span>
              <span className="text-slate-600 font-medium">Disponível</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-lg px-2 py-1.5">
              <span className="w-4 h-4 rounded bg-amber-100 ring-1 ring-amber-300 flex items-center justify-center text-[8px] text-amber-800 font-bold relative">
                !<span className="absolute -top-px -right-px w-1.5 h-1.5 rounded-full bg-amber-500" />
              </span>
              <span className="text-slate-600 font-medium">Negociando</span>
            </div>
            <div className="flex items-center gap-1.5 bg-red-50 ring-1 ring-inset ring-red-200 rounded-lg px-2 py-1.5">
              <span className="w-4 h-4 rounded bg-red-100 ring-1 ring-red-200 flex items-center justify-center text-[8px] text-red-400 font-bold line-through">✕</span>
              <span className="text-slate-600 font-medium">Reservado</span>
            </div>
            <div className="flex items-center gap-1.5 bg-orange-50 ring-1 ring-inset ring-orange-200 rounded-lg px-2 py-1.5">
              <span className="w-4 h-4 rounded bg-orange-50 ring-1 ring-orange-200 flex items-center justify-center text-[8px] text-orange-700 font-bold">S</span>
              <span className="text-slate-600 font-medium">Fim de semana</span>
            </div>
          </div>
        </div>

        {/* Selected date + split calculator */}
        {selectedDate && currentPrice !== null && (
          <div className="border-t border-slate-100 px-4 py-4 bg-sky-50/30 animate-in fade-in-50 duration-200">
            <div className="max-w-[440px] mx-auto">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Data selecionada</p>
                  <p className="text-[14px] font-bold text-slate-800 capitalize mt-0.5">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    {isWeekend(selectedDate) && (
                      <span className="ml-1.5 text-[9px] font-semibold text-orange-600 bg-orange-100 px-1 py-px rounded">FDS</span>
                    )}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black text-sky-600">R$ {currentPrice}</p>
                  <p className="text-[9px] text-slate-400">/dia</p>
                </div>
              </div>

              {/* Split calculator */}
              <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    <span className="text-[13px] text-slate-500 font-medium">Dividir por quantos?</span>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2} max={30}
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
          </div>
        )}
      </div>
    </section>
  );
}
