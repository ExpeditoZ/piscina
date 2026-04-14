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
  getWeatherLabel,
  createWeatherMap,
} from "@/lib/weather";
import type { Pricing, WeatherDay, BookingCalendar } from "@/lib/types";

/* ==============================================
   MONTH NAV BAR
   ============================================== */
function MonthNav({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();
  return (
    <div className="flex items-center justify-between mb-3">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        aria-label="Mês anterior"
        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600 inline-flex items-center justify-center active:scale-95 transition-colors disabled:opacity-20"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-[15px] font-extrabold text-slate-800 capitalize">
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

/* ==============================================
   POOL CALENDAR
   ============================================== */
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

  useEffect(() => { (async () => { setLoadingWeather(true); setWeatherMap(createWeatherMap(await fetchWeather())); setLoadingWeather(false); })(); }, []);

  useEffect(() => { (async () => {
    const sb = createClient(); const { data } = await sb.from("calendar_bookings").select("booking_date, status").eq("pool_id", poolId);
    const m: BookingStatusMap = new Map(); (data as BookingCalendar[])?.forEach((b) => { if (b.status === "cancelled") return; const ex = m.get(b.booking_date); if (!ex || b.status === "confirmed") m.set(b.booking_date, b.status as "negotiating" | "confirmed"); }); setBookingStatuses(m);
  })(); }, [poolId]);

  useEffect(() => {
    const sb = createClient(); const ch = sb.channel(`bk-${poolId}`).on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `pool_id=eq.${poolId}` }, (p) => {
      const b = p.new as BookingCalendar & { pool_id: string }; if (!b?.booking_date) return;
      setBookingStatuses((prev) => { const n = new Map(prev); if (p.eventType === "DELETE" || b.status === "cancelled") n.delete(b.booking_date); else n.set(b.booking_date, b.status as "negotiating" | "confirmed"); return n; });
    }).subscribe(); return () => { sb.removeChannel(ch); };
  }, [poolId]);

  const handleDateClick = useCallback((date: Date) => {
    const ds = format(date, "yyyy-MM-dd"); const st = bookingStatuses.get(ds);
    if (st === "confirmed") { toast.error("Esta data já está reservada."); return; }
    if (st === "negotiating") { toast.warning("Alguém está negociando esta data! 🔥", { description: "Aguarde ou escolha outra data disponível." }); return; }
    const p = isWeekend(date) ? pricing.weekend : pricing.weekday; setSelectedDate(date); setCurrentPrice(p); onDateSelect(date, p);
  }, [bookingStatuses, pricing, onDateSelect]);

  const disabledDays = useCallback((d: Date) => isBefore(d, today) || bookingStatuses.get(format(d, "yyyy-MM-dd")) === "confirmed", [today, bookingStatuses]);

  const modifiers = useMemo(() => {
    const n: Date[] = []; const c: Date[] = [];
    bookingStatuses.forEach((s, ds) => { const d = new Date(ds + "T12:00:00"); if (s === "negotiating") n.push(d); if (s === "confirmed") c.push(d); });
    return { negotiating: n, confirmed: c };
  }, [bookingStatuses]);

  const splitValue = useMemo(() => { const n = parseInt(splitCount); if (!currentPrice || !n || n < 2) return null; return Math.ceil(currentPrice / n); }, [currentPrice, splitCount]);

  // Weather for selected date
  const selectedWeather = useMemo(() => {
    if (!selectedDate) return null;
    return weatherMap.get(format(selectedDate, "yyyy-MM-dd")) ?? null;
  }, [selectedDate, weatherMap]);

  return (
    <section id="calendar" className="scroll-mt-16 space-y-3">
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* ── CENTERED CALENDAR STAGE ── */}
        <div className="max-w-lg w-full mx-auto px-4 sm:px-6 pt-5 pb-4">
          {/* Header — centered inside the stage */}
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-[15px]">Escolha sua data</h2>
            {loadingWeather && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300 ml-1" />}
          </div>

          {/* DayPicker */}
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
              months: "",
              month: "",
              nav: "hidden",
              month_caption: "",
              caption_label: "hidden",
              weekdays: "grid grid-cols-7 gap-1.5 sm:gap-2 mb-2",
              weekday: "text-center text-[11px] font-bold text-slate-400 uppercase py-1",
              week: "grid grid-cols-7 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2",
              day: "",
              day_button: "w-full aspect-square rounded-xl text-sm font-semibold relative flex flex-col items-center justify-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
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

                let cls: string;
                if (isSel) {
                  cls = "bg-sky-500 text-white shadow-lg shadow-sky-400/40 scale-105 z-10";
                } else if (isPast) {
                  cls = "bg-slate-50 text-slate-300";
                } else if (isConfirmed) {
                  cls = "bg-slate-200 text-slate-400 line-through";
                } else if (isNegotiating) {
                  cls = "bg-amber-200 text-amber-900 font-bold";
                } else if (isWknd) {
                  cls = "bg-emerald-100 text-emerald-700 hover:bg-emerald-200";
                } else {
                  cls = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
                }
                if (isToday && !isSel) cls += " ring-2 ring-sky-400 ring-offset-1";

                return (
                  <button
                    {...props} disabled={isDisabled}
                    onClick={(e) => {
                      if (isNegotiating) { e.preventDefault(); toast.warning("Alguém está negociando esta data! 🔥", { description: "Aguarde ou escolha outra data disponível." }); return; }
                      props.onClick?.(e);
                    }}
                    className={`${props.className ?? ""} ${cls}`}
                  >
                    <span className="leading-none">{props.day.date.getDate()}</span>
                    {weather && !isPast && !isConfirmed && (
                      <span className={`text-[7px] leading-none mt-0.5 ${isSel ? "text-sky-100" : "opacity-40"}`}>
                        {getWeatherIcon(weather.weatherCode)} {weather.temperatureMax}°
                      </span>
                    )}
                    {isWknd && !isPast && !isConfirmed && !isNegotiating && !isSel && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                    )}
                    {isNegotiating && !isSel && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-1 ring-white" />
                    )}
                    {isConfirmed && !isPast && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-400 ring-1 ring-white" />
                    )}
                  </button>
                );
              },
            }}
          />

          {/* Legend — compact, secondary */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Disponível</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-300" /> Negociando</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 border border-slate-300" /> Reservado</span>
            <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-400" /> Fim de semana</span>
          </div>
        </div>

        {/* ── SELECTED DATE SUMMARY ── */}
        {selectedDate && currentPrice !== null && (
          <div className="border-t border-slate-100 bg-slate-50/60">
            <div className="max-w-lg mx-auto px-4 sm:px-6 py-4">
              {/* Main row: Date info + Price */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-slate-800 capitalize leading-snug">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </p>

                  {/* Weather — clearly visible */}
                  {selectedWeather ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-lg leading-none">{getWeatherIcon(selectedWeather.weatherCode)}</span>
                      <span className="text-[13px] text-slate-600">
                        {selectedWeather.temperatureMax}°C
                        <span className="text-slate-400 mx-1">·</span>
                        {getWeatherLabel(selectedWeather.weatherCode)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400 mt-1">Previsão indisponível</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black text-sky-600 leading-none">R$ {currentPrice}</p>
                  <p className="text-[10px] text-slate-400 mt-1">/dia</p>
                </div>
              </div>

              {/* Split calculator */}
              <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    <span className="text-[13px] text-slate-500 font-medium">Dividir por quantos?</span>
                  </div>
                  <input
                    type="number" inputMode="numeric" min={2} max={30}
                    value={splitCount} onChange={(e) => setSplitCount(e.target.value)}
                    placeholder="—"
                    className="w-16 h-9 text-center text-sm font-bold bg-white border border-slate-200 rounded-lg focus:border-purple-300 focus:ring-1 focus:ring-purple-100 outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
                {splitValue && (
                  <div className="mt-3 py-2.5 rounded-xl bg-purple-50 text-center animate-in fade-in-50 duration-150">
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
