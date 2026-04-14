"use client";

import { useState, useEffect, useMemo } from "react";
import { format, isWeekend, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle,
  Clock,
  ShoppingBag,
  ScrollText,
  User,
  Loader2,
  PartyPopper,
  X,
  CalendarRange,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import type {
  PoolPublic,
  ShiftOption,
  UpsellExtra,
  BookingSelection,
  BookingMode,
} from "@/lib/types";

interface CheckoutModalProps {
  pool: PoolPublic;
  selection: BookingSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckoutModal({
  pool,
  selection,
  open,
  onOpenChange,
}: CheckoutModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guest info
  const [guestName, setGuestName] = useState("");
  const [arrivalTime, setArrivalTime] = useState("10:00");

  // Booking mode choice (single-day only)
  const [bookingChoice, setBookingChoice] = useState<"full_day" | "shift">(
    "full_day"
  );
  const [selectedShift, setSelectedShift] = useState<ShiftOption | null>(null);

  // Upsell selections
  const [selectedUpsells, setSelectedUpsells] = useState<Set<string>>(
    new Set()
  );

  // Rules agreement
  const [rulesAccepted, setRulesAccepted] = useState(false);

  // Feature flags
  const hasShifts =
    pool.shifts_config?.enabled && pool.shifts_config.options.length > 0;
  const hasExtras = pool.upsell_extras && pool.upsell_extras.length > 0;
  const hasRules = !!pool.rules;

  const isSingleDay = selection?.mode !== "range";
  const isRange = selection?.mode === "range";

  // Pre-fill guest name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem("guestName");
    if (savedName) setGuestName(savedName);
  }, []);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelectedShift(null);
      setBookingChoice("full_day");
      setSelectedUpsells(new Set());
      setRulesAccepted(false);
    }
  }, [open]);

  // ---- Derived: effective booking mode ----
  const effectiveMode: BookingMode = useMemo(() => {
    if (isRange) return "range";
    if (isSingleDay && hasShifts && bookingChoice === "shift" && selectedShift)
      return "shift";
    return "full_day";
  }, [isRange, isSingleDay, hasShifts, bookingChoice, selectedShift]);

  // ---- Derived: base price ----
  const basePrice = useMemo(() => {
    if (!selection) return 0;
    if (effectiveMode === "shift" && selectedShift) return selectedShift.price;
    return selection.basePrice;
  }, [selection, effectiveMode, selectedShift]);

  // ---- Derived: total days ----
  const totalDays = selection?.totalDays ?? 1;

  // ---- Derived: per-day breakdown (for range) ----
  const dayBreakdown = useMemo(() => {
    if (!selection) return [];
    const days = eachDayOfInterval({
      start: selection.startDate,
      end: selection.endDate,
    });
    return days.map((d) => ({
      date: format(d, "yyyy-MM-dd"),
      label: format(d, "EEE d/MM", { locale: ptBR }),
      isWeekend: isWeekend(d),
      price: isWeekend(d) ? pool.pricing.weekend : pool.pricing.weekday,
    }));
  }, [selection, pool.pricing]);

  // ---- Extras calculation ----
  const extrasBreakdown = useMemo(() => {
    if (!hasExtras || !pool.upsell_extras) return [];
    return pool.upsell_extras
      .filter((e) => selectedUpsells.has(e.id))
      .map((e) => {
        const billing = e.billing ?? "per_reservation";
        const quantity = billing === "per_day" ? totalDays : 1;
        return {
          id: e.id,
          name: e.name,
          unitPrice: e.price,
          billing,
          quantity,
          total: e.price * quantity,
        };
      });
  }, [selectedUpsells, hasExtras, pool.upsell_extras, totalDays]);

  const extrasTotal = extrasBreakdown.reduce((s, e) => s + e.total, 0);

  // ---- Total price ----
  const totalPrice = basePrice + extrasTotal;

  // ---- Upsell toggle ----
  function toggleUpsell(id: string) {
    setSelectedUpsells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- Validation ----
  const canSubmit = useMemo(() => {
    if (!guestName.trim()) return false;
    if (!arrivalTime.trim()) return false;
    if (hasRules && !rulesAccepted) return false;
    // Single day with shifts: must choose shift OR full day
    if (isSingleDay && hasShifts && bookingChoice === "shift" && !selectedShift)
      return false;
    return true;
  }, [
    guestName,
    arrivalTime,
    hasRules,
    rulesAccepted,
    isSingleDay,
    hasShifts,
    bookingChoice,
    selectedShift,
  ]);

  // ---- Submit ----
  async function handleSubmit() {
    if (!canSubmit || !selection || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const startStr = format(selection.startDate, "yyyy-MM-dd");
      const endStr = format(selection.endDate, "yyyy-MM-dd");
      const formattedStart = format(selection.startDate, "dd/MM/yyyy (EEEE)", {
        locale: ptBR,
      });

      localStorage.setItem("guestName", guestName.trim());

      // Build WhatsApp message
      const upsellNames = extrasBreakdown.map((e) => e.name).join(", ");
      const shiftText =
        effectiveMode === "shift" && selectedShift
          ? `Turno: ${selectedShift.name}`
          : effectiveMode === "range"
          ? `Período: ${formattedStart} → ${format(selection.endDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })} (${totalDays} dias)`
          : "Dia inteiro";
      const extrasText = upsellNames ? `Extras: ${upsellNames}` : "";
      const rulesText = hasRules ? "Li e concordo com as regras." : "";

      const whatsappMessage = [
        `Olá! Quero alugar *${pool.title}*${
          effectiveMode === "range"
            ? ` de *${formattedStart}* a *${format(selection.endDate, "dd/MM/yyyy")}* (${totalDays} dias)`
            : ` no dia *${formattedStart}*`
        }`,
        shiftText,
        extrasText,
        rulesText,
        `Meu nome é *${guestName.trim()}* e chegarei às *${arrivalTime}*`,
        `Total: *R$ ${totalPrice}*`,
        `Como faço para pagar via PIX?`,
      ]
        .filter(Boolean)
        .join(". ");

      // Call booking API
      const res = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolId: pool.id,
          guestName: guestName.trim(),
          arrivalTime,
          bookingMode: effectiveMode,
          startDate: startStr,
          endDate: endStr,
          shiftSelected: selectedShift?.name ?? null,
          selectedUpsellIds: hasExtras ? Array.from(selectedUpsells) : [],
          whatsappMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erro ao registrar reserva.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Reserva registrada! Redirecionando para o WhatsApp...", {
        icon: <PartyPopper className="h-4 w-4" />,
      });

      setTimeout(() => {
        if (data.whatsappUrl) {
          window.open(data.whatsappUrl, "_blank");
        } else {
          toast.info(
            "O proprietário foi notificado. Aguarde o contato via WhatsApp."
          );
        }
        onOpenChange(false);
        setIsSubmitting(false);
      }, 800);
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Erro inesperado. Tente novamente.");
      setIsSubmitting(false);
    }
  }

  if (!selection) return null;

  const savedName =
    typeof window !== "undefined" ? localStorage.getItem("guestName") : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <SheetHeader className="px-5 pt-2 pb-0">
          <SheetTitle className="text-lg font-bold text-slate-800">
            Reservar {pool.title}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-sm">
            {isRange ? (
              <span className="flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4 text-sky-500" />
                {format(selection.startDate, "d MMM", { locale: ptBR })} →{" "}
                {format(selection.endDate, "d MMM", { locale: ptBR })}
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-700">
                  {totalDays} dias
                </span>
              </span>
            ) : (
              <span className="capitalize">
                📅 {format(selection.startDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-4 space-y-5">
          {/* ===== Step 1: Booking Type (single-day with shifts) ===== */}
          {isSingleDay && hasShifts && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm text-slate-800">
                  Tipo de reserva
                </h3>
              </div>
              <RadioGroup
                value={
                  bookingChoice === "full_day"
                    ? "__full_day__"
                    : selectedShift?.name ?? ""
                }
                onValueChange={(val) => {
                  if (val === "__full_day__") {
                    setBookingChoice("full_day");
                    setSelectedShift(null);
                  } else {
                    setBookingChoice("shift");
                    const shift = pool.shifts_config!.options.find(
                      (s) => s.name === val
                    );
                    setSelectedShift(shift ?? null);
                  }
                }}
              >
                {/* Full day option */}
                <label
                  className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    bookingChoice === "full_day"
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="__full_day__" />
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        Dia Inteiro
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Acesso o dia todo
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">
                    R${" "}
                    {isWeekend(selection.startDate)
                      ? pool.pricing.weekend
                      : pool.pricing.weekday}
                  </span>
                </label>

                {/* Shift options */}
                {pool.shifts_config!.options.map((shift) => (
                  <label
                    key={shift.name}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      bookingChoice === "shift" &&
                      selectedShift?.name === shift.name
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-100 hover:border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={shift.name} />
                      <div>
                        <span className="text-sm font-medium text-slate-700">
                          {shift.name}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-600">
                      R$ {shift.price}
                    </span>
                  </label>
                ))}
              </RadioGroup>
              <Separator />
            </div>
          )}

          {/* ===== Range breakdown (range mode) ===== */}
          {isRange && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-sky-500" />
                <h3 className="font-semibold text-sm text-slate-800">
                  Detalhes do período
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                {dayBreakdown.map((day) => (
                  <div
                    key={day.date}
                    className="flex justify-between text-[12px]"
                  >
                    <span className="text-slate-500 capitalize">
                      {day.label}
                      {day.isWeekend && (
                        <span className="text-orange-500 ml-1 font-medium">
                          FDS
                        </span>
                      )}
                    </span>
                    <span className="text-slate-700 font-medium">
                      R$ {day.price}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}

          {/* ===== Step 2: Extras ===== */}
          {hasExtras && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm text-slate-800">
                  Adicionar extras
                </h3>
              </div>
              <div className="space-y-2">
                {pool.upsell_extras!.map((extra: UpsellExtra) => {
                  const billing = extra.billing ?? "per_reservation";
                  const qty = billing === "per_day" ? totalDays : 1;
                  const lineTotal = extra.price * qty;

                  return (
                    <label
                      key={extra.id}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedUpsells.has(extra.id)
                          ? "border-purple-300 bg-purple-50"
                          : "border-slate-100 hover:border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedUpsells.has(extra.id)}
                          onCheckedChange={() => toggleUpsell(extra.id)}
                        />
                        <div>
                          <span className="text-sm text-slate-700">
                            {extra.name}
                          </span>
                          {billing === "per_day" && totalDays > 1 && (
                            <p className="text-[10px] text-slate-400">
                              R$ {extra.price} × {qty} dias
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-purple-600">
                        + R$ {lineTotal}
                      </span>
                    </label>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}

          {/* ===== Step 3: Guest Details ===== */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-sky-500" />
              <h3 className="font-semibold text-sm text-slate-800">
                Seus dados
              </h3>
              {savedName && guestName === savedName && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-100">
                  Bem-vindo de volta, {savedName.split(" ")[0]}! 👋
                </span>
              )}
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest-name" className="text-xs text-slate-600">
                  Seu nome *
                </Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="h-10 bg-slate-50/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="arrival-time"
                  className="text-xs text-slate-600"
                >
                  Horário de chegada *
                </Label>
                <Input
                  id="arrival-time"
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="h-10 bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          {/* ===== Step 4: Rules ===== */}
          {hasRules && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-slate-500" />
                  <h3 className="font-semibold text-sm text-slate-800">
                    Regras da piscina
                  </h3>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {pool.rules}
                  </p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={rulesAccepted}
                    onCheckedChange={(checked) =>
                      setRulesAccepted(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    Declaro que li e concordo com todas as regras da piscina
                    listadas acima. *
                  </span>
                </label>
              </div>
            </>
          )}

          <Separator />

          {/* ===== Price Summary ===== */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-100">
            <div className="space-y-1.5">
              {/* Base price */}
              {effectiveMode === "shift" && selectedShift ? (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{selectedShift.name}</span>
                  <span>R$ {selectedShift.price}</span>
                </div>
              ) : effectiveMode === "range" ? (
                <>
                  {(() => {
                    const weekdays = dayBreakdown.filter((d) => !d.isWeekend);
                    const weekends = dayBreakdown.filter((d) => d.isWeekend);
                    return (
                      <>
                        {weekdays.length > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>
                              {weekdays.length} dia{weekdays.length > 1 ? "s" : ""} de semana × R${" "}
                              {pool.pricing.weekday}
                            </span>
                            <span>
                              R${" "}
                              {weekdays.reduce((s, d) => s + d.price, 0)}
                            </span>
                          </div>
                        )}
                        {weekends.length > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>
                              {weekends.length} dia{weekends.length > 1 ? "s" : ""} de FDS × R${" "}
                              {pool.pricing.weekend}
                            </span>
                            <span>
                              R${" "}
                              {weekends.reduce((s, d) => s + d.price, 0)}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    Diária (
                    {isWeekend(selection.startDate)
                      ? "fim de semana"
                      : "dia de semana"}
                    )
                  </span>
                  <span>R$ {basePrice}</span>
                </div>
              )}

              {/* Extras breakdown */}
              {extrasBreakdown.map((e) => (
                <div
                  key={e.id}
                  className="flex justify-between text-xs text-slate-500"
                >
                  <span>
                    {e.name}
                    {e.quantity > 1 && (
                      <span className="text-slate-400">
                        {" "}
                        ({e.quantity}×)
                      </span>
                    )}
                  </span>
                  <span>+ R$ {e.total}</span>
                </div>
              ))}

              <Separator className="my-2" />

              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Total</span>
                <span className="text-xl font-bold text-sky-600">
                  R$ {totalPrice}
                </span>
              </div>
            </div>
          </div>

          {/* ===== Submit ===== */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="w-full h-12 text-base font-bold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50"
            style={{
              backgroundColor:
                canSubmit && !isSubmitting ? "#25D366" : undefined,
              color: canSubmit && !isSubmitting ? "#fff" : undefined,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                <MessageCircle className="h-5 w-5 mr-2" />
                Reservar via WhatsApp
              </>
            )}
          </Button>

          {!canSubmit && (
            <p className="text-[10px] text-center text-slate-400">
              {!guestName.trim()
                ? "Preencha seu nome para continuar"
                : isSingleDay &&
                  hasShifts &&
                  bookingChoice === "shift" &&
                  !selectedShift
                ? "Escolha um turno para continuar"
                : hasRules && !rulesAccepted
                ? "Aceite as regras para continuar"
                : "Preencha todos os campos obrigatórios"}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
