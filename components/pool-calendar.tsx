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
  isAfter,
  startOfDay,
  isWeekend,
  addMonths,
  eachDayOfInterval,
  differenceInCalendarDays,
  isSameDay,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  CalendarRange,
  Sun,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  fetchWeather,
  getWeatherIcon,
  getWeatherLabel,
  createWeatherMap,
} from "@/lib/weather";
import type {
  Pricing,
  ShiftsConfig,
  WeatherDay,
  BookingCalendar,
  BookingSelection,
} from "@/lib/types";

/* ==============================================
   Types for internal availability map
   ============================================== */
interface DayAvailability {
  morningStatus: "available" | "negotiating" | "confirmed";
  nightStatus: "available" | "negotiating" | "confirmed";
  fullDayStatus: "available" | "negotiating" | "confirmed";
  // Computed: is the entire day blocked?
  isFullyBlocked: boolean;
  // Computed: is ANY shift/booking on this day?
  hasAnyBooking: boolean;
}

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
  shiftsConfig: ShiftsConfig | null;
  onSelectionChange: (selection: BookingSelection | null) => void;
}

export function PoolCalendar({
  poolId,
  pricing,
  shiftsConfig,
  onSelectionChange,
}: PoolCalendarProps) {
  // Selection state: two-click range
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Data
  const [calendarData, setCalendarData] = useState<BookingCalendar[]>([]);
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherDay>>(new Map());
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [splitCount, setSplitCount] = useState("");

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = addMonths(today, 3);

  const hasShifts = shiftsConfig?.enabled && shiftsConfig.options.length > 0;

  // ---- Fetch weather ----
  useEffect(() => {
    (async () => {
      setLoadingWeather(true);
      setWeatherMap(createWeatherMap(await fetchWeather()));
      setLoadingWeather(false);
    })();
  }, []);

  // ---- Fetch calendar bookings ----
  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("calendar_bookings")
        .select("booking_date, shift_selected, booking_mode, status")
        .eq("pool_id", poolId);
      setCalendarData((data as BookingCalendar[]) ?? []);
    })();
  }, [poolId]);

  // ---- Realtime subscription ----
  useEffect(() => {
    const sb = createClient();
    const ch = sb
      .channel(`bk-${poolId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `pool_id=eq.${poolId}`,
        },
        () => {
          // Refetch calendar data on any booking change
          (async () => {
            const { data } = await sb
              .from("calendar_bookings")
              .select("booking_date, shift_selected, booking_mode, status")
              .eq("pool_id", poolId);
            setCalendarData((data as BookingCalendar[]) ?? []);
          })();
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [poolId]);

  // ---- Build availability map ----
  const availabilityMap = useMemo(() => {
    const m = new Map<string, DayAvailability>();

    for (const b of calendarData) {
      if (b.status === "cancelled") continue;
      const ds = b.booking_date;
      const existing = m.get(ds) ?? {
        morningStatus: "available" as const,
        nightStatus: "available" as const,
        fullDayStatus: "available" as const,
        isFullyBlocked: false,
        hasAnyBooking: false,
      };

      const st = b.status as "negotiating" | "confirmed";

      if (b.booking_mode === "full_day" || b.booking_mode === "range") {
        existing.fullDayStatus = st;
        existing.morningStatus = st;
        existing.nightStatus = st;
        existing.isFullyBlocked = true;
      } else if (b.booking_mode === "shift" && b.shift_selected) {
        existing.hasAnyBooking = true;
        // Determine which shift
        const shiftName = b.shift_selected.toLowerCase();
        if (shiftName.includes("manhã") || shiftName.includes("morning") || shiftName.includes("8h")) {
          existing.morningStatus = st;
        } else {
          existing.nightStatus = st;
        }
        // If both shifts are booked, the day is fully blocked
        if (existing.morningStatus !== "available" && existing.nightStatus !== "available") {
          existing.isFullyBlocked = true;
        }
      }

      existing.hasAnyBooking = existing.morningStatus !== "available" || existing.nightStatus !== "available" || existing.fullDayStatus !== "available";
      m.set(ds, existing);
    }

    return m;
  }, [calendarData]);

  // ---- Derived selection state ----
  const selectionMode = useMemo(() => {
    if (!startDate) return null;
    if (!endDate || isSameDay(startDate, endDate)) return "single";
    return "range";
  }, [startDate, endDate]);

  const totalDays = useMemo(() => {
    if (!startDate) return 0;
    if (!endDate || isSameDay(startDate, endDate)) return 1;
    return differenceInCalendarDays(endDate, startDate) + 1;
  }, [startDate, endDate]);

  const rangeDates = useMemo(() => {
    if (!startDate) return [];
    const end = endDate ?? startDate;
    return eachDayOfInterval({ start: startDate, end });
  }, [startDate, endDate]);

  // ---- Calculate price ----
  const basePrice = useMemo(() => {
    if (!startDate) return 0;
    return rangeDates.reduce((sum, d) => {
      return sum + (isWeekend(d) ? pricing.weekend : pricing.weekday);
    }, 0);
  }, [rangeDates, pricing, startDate]);

  const splitValue = useMemo(() => {
    const n = parseInt(splitCount);
    if (!basePrice || !n || n < 2) return null;
    return Math.ceil(basePrice / n);
  }, [basePrice, splitCount]);

  const selectedWeather = useMemo(() => {
    if (!startDate) return null;
    return weatherMap.get(format(startDate, "yyyy-MM-dd")) ?? null;
  }, [startDate, weatherMap]);

  // ---- Range validity check ----
  const rangeConflict = useMemo(() => {
    if (selectionMode !== "range") return null;
    for (const d of rangeDates) {
      const ds = format(d, "yyyy-MM-dd");
      const avail = availabilityMap.get(ds);
      if (avail?.isFullyBlocked) {
        return `A data ${format(d, "dd/MM")} não está disponível para reserva.`;
      }
      // For range mode, we also block days that have ANY booking (even a shift)
      if (avail?.hasAnyBooking) {
        return `A data ${format(d, "dd/MM")} já tem uma reserva parcial. Reservas de período requerem dias completamente livres.`;
      }
    }
    return null;
  }, [selectionMode, rangeDates, availabilityMap]);

  // ---- Notify parent of selection changes ----
  useEffect(() => {
    if (!startDate) {
      onSelectionChange(null);
      return;
    }
    const end = endDate ?? startDate;

    // Don't emit if range has conflicts
    if (selectionMode === "range" && rangeConflict) {
      onSelectionChange(null);
      return;
    }

    const selection: BookingSelection = {
      mode: selectionMode === "range" ? "range" : "full_day",
      startDate,
      endDate: end,
      totalDays,
      shiftSelected: null, // Shift selection happens in checkout
      basePrice,
    };
    onSelectionChange(selection);
  }, [startDate, endDate, selectionMode, totalDays, basePrice, rangeConflict, onSelectionChange]);

  // ---- Handle date click ----
  const handleDateClick = useCallback(
    (date: Date) => {
      const ds = format(date, "yyyy-MM-dd");
      const avail = availabilityMap.get(ds);

      // Block fully blocked dates
      if (avail?.isFullyBlocked) {
        const st = avail.fullDayStatus;
        if (st === "confirmed") {
          toast.error("Esta data já está reservada.");
        } else {
          toast.warning("Alguém está negociando esta data! 🔥", {
            description: "Aguarde ou escolha outra data disponível.",
          });
        }
        return;
      }

      if (!startDate) {
        // First click: set start
        setStartDate(date);
        setEndDate(null);
        setSplitCount("");
      } else if (!endDate) {
        // Second click
        if (isSameDay(date, startDate)) {
          // Same day clicked again — confirmed as single day
          setEndDate(date);
        } else if (isBefore(date, startDate)) {
          // Clicked before start — reset to this as new start
          setStartDate(date);
          setEndDate(null);
        } else {
          // Clicked after start — this is the end date
          setEndDate(date);
        }
        setSplitCount("");
      } else {
        // Already have a range — reset with new start
        setStartDate(date);
        setEndDate(null);
        setSplitCount("");
      }
    },
    [startDate, endDate, availabilityMap]
  );

  const clearSelection = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
    setSplitCount("");
    onSelectionChange(null);
  }, [onSelectionChange]);

  // ---- Disabled days ----
  const disabledDays = useCallback(
    (d: Date): boolean => {
      if (isBefore(d, today)) return true;
      const ds = format(d, "yyyy-MM-dd");
      const avail = availabilityMap.get(ds);
      if (!avail) return false;
      return avail.isFullyBlocked && avail.fullDayStatus === "confirmed";
    },
    [today, availabilityMap]
  );

  // ---- Check if a date is in selected range ----
  const isInRange = useCallback(
    (date: Date) => {
      if (!startDate) return false;
      const end = endDate ?? hoverDate;
      if (!end) return false;
      const [rangeStart, rangeEnd] = isBefore(startDate, end)
        ? [startDate, end]
        : [end, startDate];
      return (
        !isBefore(date, rangeStart) &&
        !isAfter(date, rangeEnd)
      );
    },
    [startDate, endDate, hoverDate]
  );

  return (
    <section id="calendar" className="scroll-mt-16 space-y-3">
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* CENTERED STAGE */}
        <div className="max-w-lg w-full mx-auto px-4 sm:px-6 pt-5 pb-4">
          {/* Header */}
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-[15px]">
              {selectionMode === "range" ? "Período selecionado" : "Escolha sua data"}
            </h2>
            {loadingWeather && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300 ml-1" />}
          </div>

          {/* Selection hint */}
          {!startDate && (
            <p className="text-center text-[11px] text-slate-400 -mt-2 mb-3">
              Toque em uma data · Para período, toque no início e depois no fim
            </p>
          )}
          {startDate && !endDate && (
            <p className="text-center text-[11px] text-sky-500 font-medium -mt-2 mb-3 animate-pulse">
              Toque na mesma data para 1 dia, ou em outra para período
            </p>
          )}

          {/* DayPicker */}
          <DayPicker
            mode="single"
            selected={undefined}
            onSelect={() => {}}
            locale={ptBR}
            disabled={disabledDays}
            fromDate={today}
            toDate={maxDate}
            showOutsideDays
            classNames={{
              root: "",
              months: "",
              month: "",
              nav: "hidden",
              month_caption: "",
              caption_label: "hidden",
              month_grid: "",
              weekdays: "",
              weekday: "text-center text-[11px] font-bold text-slate-400 uppercase",
              weeks: "",
              week: "",
              day: "",
              day_button:
                "w-full aspect-square rounded-xl text-sm font-semibold relative flex flex-col items-center justify-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
              disabled: "cursor-not-allowed",
              today: "",
              selected: "",
              outside: "invisible",
            }}
            components={{
              MonthCaption: MonthNav,
              DayButton: (props: DayButtonProps) => {
                const date = props.day.date;
                const dateStr = format(date, "yyyy-MM-dd");
                const weather = weatherMap.get(dateStr);
                const avail = availabilityMap.get(dateStr);
                const isPast = isBefore(date, today);
                const isBlocked = avail?.isFullyBlocked ?? false;
                const isNegotiating = avail?.fullDayStatus === "negotiating" || (avail?.morningStatus === "negotiating" && avail?.nightStatus === "negotiating");
                const isConfirmed = avail?.fullDayStatus === "confirmed";
                const hasPartialBooking = avail?.hasAnyBooking && !avail?.isFullyBlocked;
                const isWknd = isWeekend(date);
                const isStart = startDate ? isSameDay(date, startDate) : false;
                const isEnd = endDate ? isSameDay(date, endDate) : false;
                const inRange = isInRange(date);
                const isToday = dateStr === format(today, "yyyy-MM-dd");

                let cls: string;
                if (isStart || isEnd) {
                  cls = "bg-sky-500 text-white shadow-lg shadow-sky-400/40 scale-105 z-10";
                } else if (inRange && !isPast && !isBlocked) {
                  cls = "bg-sky-100 text-sky-700 ring-1 ring-sky-300";
                } else if (isPast) {
                  cls = "bg-slate-50 text-slate-300";
                } else if (isConfirmed) {
                  cls = "bg-slate-200 text-slate-400 line-through";
                } else if (isNegotiating) {
                  cls = "bg-amber-200 text-amber-900 font-bold";
                } else if (hasPartialBooking) {
                  cls = "bg-amber-50 text-amber-700 hover:bg-amber-100";
                } else if (isWknd) {
                  cls = "bg-emerald-100 text-emerald-700 hover:bg-emerald-200";
                } else {
                  cls = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
                }
                if (isToday && !isStart && !isEnd)
                  cls += " ring-2 ring-sky-400 ring-offset-1";

                return (
                  <button
                    {...props}
                    disabled={isPast || isConfirmed}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDateClick(date);
                    }}
                    onMouseEnter={() => {
                      if (startDate && !endDate) setHoverDate(date);
                    }}
                    onMouseLeave={() => setHoverDate(null)}
                    className={`${props.className ?? ""} ${cls}`}
                  >
                    <span className="leading-none">{date.getDate()}</span>
                    {weather && !isPast && !isConfirmed && (
                      <span
                        className={`text-[7px] leading-none mt-0.5 ${
                          isStart || isEnd
                            ? "text-sky-100"
                            : inRange
                            ? "text-sky-400"
                            : "opacity-40"
                        }`}
                      >
                        {getWeatherIcon(weather.weatherCode)} {weather.temperatureMax}°
                      </span>
                    )}
                    {isWknd && !isPast && !isConfirmed && !isNegotiating && !isStart && !isEnd && !inRange && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                    )}
                    {hasPartialBooking && !isStart && !isEnd && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" />
                    )}
                    {isNegotiating && !isStart && !isEnd && (
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

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Disponível</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> Turno parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-300" /> Negociando</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 border border-slate-300" /> Reservado</span>
            <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-400" /> Fim de semana</span>
          </div>
        </div>

        {/* SELECTION SUMMARY */}
        {startDate && (
          <div className="border-t border-slate-100 bg-slate-50/60">
            <div className="max-w-lg mx-auto px-4 sm:px-6 py-4">
              {/* Clear button */}
              <button
                onClick={clearSelection}
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Limpar seleção"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {selectionMode === "range" ? (
                /* ---- RANGE SUMMARY ---- */
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarRange className="h-4 w-4 text-sky-500" />
                    <span className="text-[13px] font-bold text-slate-800">
                      Período de {totalDays} dias
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-600 capitalize">
                    {format(startDate, "EEE, d MMM", { locale: ptBR })} →{" "}
                    {format(endDate!, "EEE, d MMM", { locale: ptBR })}
                  </p>

                  {rangeConflict ? (
                    <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-[12px] text-red-600 font-medium">
                        ⚠ {rangeConflict}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Per-day breakdown */}
                      <div className="mt-3 space-y-1">
                        {rangeDates.map((d) => {
                          const wknd = isWeekend(d);
                          const p = wknd ? pricing.weekend : pricing.weekday;
                          return (
                            <div key={format(d, "yyyy-MM-dd")} className="flex justify-between text-[11px]">
                              <span className="text-slate-500 capitalize">
                                {format(d, "EEE d/MM", { locale: ptBR })}
                                {wknd && <span className="text-orange-500 ml-1">FDS</span>}
                              </span>
                              <span className="text-slate-600 font-medium">R$ {p}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200">
                        <span className="font-bold text-slate-800 text-[13px]">Total</span>
                        <span className="text-xl font-black text-sky-600">R$ {basePrice}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* ---- SINGLE DAY SUMMARY ---- */
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-slate-800 capitalize leading-snug">
                      {format(startDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
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
                    {/* Shift availability hint */}
                    {hasShifts && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[11px] text-amber-600 font-medium">
                          Turnos disponíveis — escolha no próximo passo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-black text-sky-600 leading-none">R$ {basePrice}</p>
                    <p className="text-[10px] text-slate-400 mt-1">/dia</p>
                  </div>
                </div>
              )}

              {/* Split calculator (always visible when there's a valid price) */}
              {basePrice > 0 && !rangeConflict && (
                <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
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
                    <div className="mt-3 py-2.5 rounded-xl bg-purple-50 text-center animate-in fade-in-50 duration-150">
                      <span className="text-lg font-black text-purple-600">R$ {splitValue}</span>
                      <span className="text-[11px] text-purple-400 ml-1">por pessoa</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
