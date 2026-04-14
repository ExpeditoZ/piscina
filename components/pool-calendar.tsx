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
   Custom month caption with embedded navigation
   ============================================= */
function CustomMonthCaption({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();

  return (
    <div className="flex items-center justify-between px-1 h-10 mb-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-sky-50 hover:text-sky-600 active:scale-95 transition-colors disabled:opacity-25"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="text-[14px] font-bold text-slate-800 capitalize">
        {format(calendarMonth.date, "LLLL yyyy", { locale: ptBR })}
      </span>

      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-sky-50 hover:text-sky-600 active:scale-95 transition-colors disabled:opacity-25"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
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
  const [splitCount, setSplitCount] = useState("");

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = addMonths(today, 3);

  // Fetch weather
  useEffect(() => {
    (async () => {
      setLoadingWeather(true);
      const data = await fetchWeather();
      setWeatherMap(createWeatherMap(data));
      setLoadingWeather(false);
    })();
  }, []);

  // Fetch bookings
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

  // Realtime
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

  // Date click = select only
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
      {/* Calendar card */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-[14px]">
              Escolha sua data
            </h2>
          </div>
          {loadingWeather && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />
          )}
        </div>

        {/* DayPicker */}
        <div className="px-2 sm:px-3 pb-2 flex justify-center">
          <div className="w-full max-w-[360px]">
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
                weekdays: "flex",
                weekday: "flex-1 text-center text-[10px] font-semibold text-slate-400 uppercase py-1",
                week: "flex",
                day: "flex-1 text-center p-[1px]",
                day_button:
                  "w-full aspect-square rounded-lg text-[13px] font-medium relative flex flex-col items-center justify-center transition-colors hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 aria-selected:bg-sky-500 aria-selected:text-white aria-selected:font-bold",
                disabled: "opacity-20 cursor-not-allowed hover:bg-transparent",
                today: "font-bold text-sky-600",
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
                  const isWknd = isWeekend(props.day.date);

                  let cls = "";
                  if (isNegotiating) {
                    cls = "!bg-amber-50 !text-amber-700 border border-amber-200 cursor-not-allowed hover:!bg-amber-50";
                  } else if (status === "confirmed") {
                    cls = "!bg-slate-50 !text-slate-300 line-through cursor-not-allowed hover:!bg-slate-50";
                  } else if (isWknd && !isPast) {
                    cls = "bg-orange-50/40";
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
                      className={`${props.className ?? ""} ${cls}`}
                    >
                      <span className="text-[13px] leading-none">{props.day.date.getDate()}</span>
                      {weather && !isPast && (
                        <span className="text-[7px] leading-none opacity-50 mt-0.5">
                          {getWeatherIcon(weather.weatherCode)} {weather.temperatureMax}°
                        </span>
                      )}
                      {isNegotiating && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ring-1 ring-white" />
                      )}
                    </button>
                  );
                },
              }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="px-3 pb-2">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1.5 px-2 rounded-lg bg-slate-50 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /><span className="text-slate-500">Disponível</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-slate-500">Negociando</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /><span className="text-slate-500">Reservado</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-200" /><span className="text-slate-500">Fim de semana</span></span>
          </div>
        </div>

        {/* Selected date + split calculator */}
        {selectedDate && currentPrice !== null && (
          <div className="border-t border-slate-100 px-4 py-3 bg-sky-50/40 animate-in fade-in-50 duration-200">
            {/* Date + Price */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  Data selecionada
                </p>
                <p className="text-[13px] font-bold text-slate-800 capitalize mt-0.5">
                  {format(selectedDate, "EEE, d 'de' MMMM", { locale: ptBR })}
                  {isWeekend(selectedDate) && (
                    <span className="ml-1 text-[9px] font-semibold text-orange-600 bg-orange-100 px-1 py-px rounded">
                      FDS
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-black text-sky-600">
                  R$ {currentPrice}
                </p>
                <p className="text-[9px] text-slate-400">/dia</p>
              </div>
            </div>

            {/* Split calculator */}
            <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
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
                  className="w-14 h-8 text-center text-sm font-bold bg-white border border-slate-200 rounded-lg focus:border-purple-300 focus:ring-1 focus:ring-purple-100 outline-none transition-all placeholder:text-slate-300"
                />
              </div>
              {splitValue && (
                <div className="mt-2 py-2 rounded-lg bg-purple-50 text-center animate-in fade-in-50 duration-150">
                  <span className="text-base font-black text-purple-600">
                    R$ {splitValue}
                  </span>
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
