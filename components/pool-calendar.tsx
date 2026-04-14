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
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  fetchWeather,
  getWeatherIcon,
  createWeatherMap,
} from "@/lib/weather";
import type { Pricing, WeatherDay, BookingCalendar } from "@/lib/types";

/* ================================================
   CUSTOM MONTH CAPTION WITH EMBEDDED NAV BUTTONS
   This solves the react-day-picker v9 layout issue
   where Nav is a sibling of MonthCaption, not a child.
   ================================================ */
function CustomMonthCaption({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();

  return (
    <div className="flex items-center justify-between px-1 py-2 mb-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-600 transition-colors active:scale-95 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="text-sm font-bold text-slate-800 capitalize select-none">
        {format(calendarMonth.date, "LLLL yyyy", { locale: ptBR })}
      </span>

      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-600 transition-colors active:scale-95 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ================================================
   POOL CALENDAR COMPONENT
   ================================================ */
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
  const maxDate = addMonths(today, 3);

  // Fetch weather
  useEffect(() => {
    async function loadWeather() {
      setLoadingWeather(true);
      const data = await fetchWeather();
      setWeatherMap(createWeatherMap(data));
      setLoadingWeather(false);
    }
    loadWeather();
  }, []);

  // Fetch bookings
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

  // Realtime subscription
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

  // Date click — selection only, NO checkout
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

  // Disabled days
  const disabledDays = useCallback(
    (date: Date) => {
      if (isBefore(date, today)) return true;
      const dateStr = format(date, "yyyy-MM-dd");
      return bookingStatuses.get(dateStr) === "confirmed";
    },
    [today, bookingStatuses]
  );

  // Modifiers
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
    <section id="calendar" className="scroll-mt-16">
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center">
              <svg
                className="h-3.5 w-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-[15px]">
              Escolha sua data
            </h2>
          </div>
          {loadingWeather && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />
          )}
        </div>

        {/* Calendar — uses custom MonthCaption with embedded nav */}
        <div className="px-2 sm:px-4 pb-1">
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
              month: "",
              nav: "hidden",
              month_caption: "",
              caption_label: "hidden",
              weekdays: "flex",
              weekday:
                "flex-1 text-center text-[10px] font-bold text-slate-400 uppercase py-1.5",
              week: "flex",
              day: "flex-1 text-center p-px",
              day_button:
                "w-full aspect-square rounded-lg text-[13px] font-medium transition-colors relative flex flex-col items-center justify-center hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 aria-selected:bg-sky-500 aria-selected:text-white aria-selected:font-bold aria-selected:shadow-sm",
              disabled:
                "opacity-20 cursor-not-allowed hover:bg-transparent",
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

                let cellClass = "";
                if (isNegotiating) {
                  cellClass =
                    "!bg-amber-50 !text-amber-700 border border-amber-200 cursor-not-allowed hover:!bg-amber-50";
                } else if (status === "confirmed") {
                  cellClass =
                    "!bg-slate-50 !text-slate-300 line-through cursor-not-allowed hover:!bg-slate-50";
                } else if (isWknd && !isPast) {
                  cellClass = "bg-orange-50/40";
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
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 px-2 rounded-lg bg-slate-50 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span className="text-slate-500">Disponível</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-500">Negociando</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-slate-500">Reservado</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-200" />
              <span className="text-slate-500">Fim de semana</span>
            </span>
          </div>
        </div>

        {/* Selected date result */}
        {selectedDate && currentPrice !== null && (
          <div className="border-t border-slate-100 px-4 py-3 bg-sky-50/50 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  Data selecionada
                </p>
                <p className="text-sm font-bold text-slate-800 capitalize mt-0.5">
                  {format(selectedDate, "EEE, d 'de' MMMM", { locale: ptBR })}
                  {isWeekend(selectedDate) && (
                    <span className="ml-1.5 text-[9px] font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded align-middle">
                      FDS
                    </span>
                  )}
                </p>
              </div>
              <p className="text-xl font-black text-sky-600">
                R$ {currentPrice}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
