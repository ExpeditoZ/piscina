"use client";

import { useState, useEffect, useMemo } from "react";
import { format, isWeekend } from "date-fns";
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
} from "@/lib/types";

interface CheckoutModalProps {
  pool: PoolPublic;
  selectedDate: Date | null;
  basePrice: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckoutModal({
  pool,
  selectedDate,
  basePrice,
  open,
  onOpenChange,
}: CheckoutModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guest info
  const [guestName, setGuestName] = useState("");
  const [arrivalTime, setArrivalTime] = useState("10:00");

  // Shift selection
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

  // ----- LocalStorage memory: pre-fill guest name -----
  useEffect(() => {
    const savedName = localStorage.getItem("guestName");
    if (savedName) {
      setGuestName(savedName);
    }
  }, []);

  // Reset shift/upsells when modal opens with new date
  useEffect(() => {
    if (open) {
      setSelectedShift(null);
      setSelectedUpsells(new Set());
      setRulesAccepted(false);
    }
  }, [open, selectedDate]);

  // ----- Calculate total price -----
  const totalPrice = useMemo(() => {
    let total = hasShifts && selectedShift ? selectedShift.price : basePrice;

    // Add upsells
    if (hasExtras && pool.upsell_extras) {
      pool.upsell_extras.forEach((extra) => {
        if (selectedUpsells.has(extra.id)) {
          total += extra.price;
        }
      });
    }

    return total;
  }, [basePrice, selectedShift, selectedUpsells, hasShifts, hasExtras, pool.upsell_extras]);

  // ----- Upsell toggle -----
  function toggleUpsell(id: string) {
    setSelectedUpsells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ----- Validation -----
  const canSubmit = useMemo(() => {
    if (!guestName.trim()) return false;
    if (!arrivalTime.trim()) return false;
    if (hasRules && !rulesAccepted) return false;
    return true;
  }, [guestName, arrivalTime, hasRules, rulesAccepted]);

  // ----- Submit: Create booking via server API (price recalculated server-side) -----
  async function handleSubmit() {
    if (!canSubmit || !selectedDate || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const formattedDate = format(selectedDate, "dd/MM/yyyy (EEEE)", {
        locale: ptBR,
      });

      // 1. Save guest name to localStorage
      localStorage.setItem("guestName", guestName.trim());

      // 2. Build WhatsApp message text (phone number stays server-side)
      const upsellNames = hasExtras
        ? pool
            .upsell_extras!.filter((e) => selectedUpsells.has(e.id))
            .map((e) => e.name)
            .join(", ")
        : "";

      const shiftText = selectedShift
        ? `Turno: ${selectedShift.name}`
        : "Dia inteiro";
      const extrasText = upsellNames ? `Extras: ${upsellNames}` : "";
      const rulesText = hasRules ? "Li e concordo com as regras." : "";

      const whatsappMessage = [
        `Olá! Quero alugar *${pool.title}* no dia *${formattedDate}*`,
        shiftText,
        extrasText,
        rulesText,
        `Meu nome é *${guestName.trim()}* e chegarei às *${arrivalTime}*`,
        `Total: *R$ ${totalPrice}*`,
        `Como faço para pagar via PIX?`,
      ]
        .filter(Boolean)
        .join(". ");

      // 3. Call unified booking API (price is recalculated server-side)
      const res = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolId: pool.id,
          guestName: guestName.trim(),
          arrivalTime,
          bookingDate: dateStr,
          shiftSelected: selectedShift?.name ?? null,
          selectedUpsellIds: hasExtras
            ? Array.from(selectedUpsells)
            : [],
          whatsappMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erro ao registrar reserva.");
        setIsSubmitting(false);
        return;
      }

      // 4. Show success toast + redirect to WhatsApp
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

  if (!selectedDate) return null;

  const savedName =
    typeof window !== "undefined"
      ? localStorage.getItem("guestName")
      : null;

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
            📅{" "}
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            {isWeekend(selectedDate) && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                FDS
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-4 space-y-5">
          {/* ===== Step 1: Shift Selection (Conditional) ===== */}
          {hasShifts && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm text-slate-800">
                  Escolha o turno
                </h3>
              </div>
              <RadioGroup
                value={selectedShift?.name ?? ""}
                onValueChange={(name) => {
                  const shift = pool.shifts_config!.options.find(
                    (s) => s.name === name
                  );
                  setSelectedShift(shift ?? null);
                }}
              >
                {pool.shifts_config!.options.map((shift) => (
                  <label
                    key={shift.name}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedShift?.name === shift.name
                        ? "border-sky-400 bg-sky-50"
                        : "border-slate-100 hover:border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={shift.name} />
                      <span className="text-sm font-medium text-slate-700">
                        {shift.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      R$ {shift.price}
                    </span>
                  </label>
                ))}
              </RadioGroup>
              <Separator />
            </div>
          )}

          {/* ===== Step 2: Upsell Cart (Conditional) ===== */}
          {hasExtras && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm text-slate-800">
                  Adicionar extras
                </h3>
              </div>
              <div className="space-y-2">
                {pool.upsell_extras!.map((extra: UpsellExtra) => (
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
                      <span className="text-sm text-slate-700">
                        {extra.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-purple-600">
                      + R$ {extra.price}
                    </span>
                  </label>
                ))}
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
                <Label
                  htmlFor="guest-name"
                  className="text-xs text-slate-600"
                >
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

          {/* ===== Step 4: Rules Agreement (Conditional) ===== */}
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
              <div className="flex justify-between text-xs text-slate-500">
                <span>
                  {hasShifts && selectedShift
                    ? selectedShift.name
                    : isWeekend(selectedDate)
                      ? "Diária (fim de semana)"
                      : "Diária (dia de semana)"}
                </span>
                <span>
                  R${" "}
                  {hasShifts && selectedShift
                    ? selectedShift.price
                    : basePrice}
                </span>
              </div>

              {/* Upsells breakdown */}
              {hasExtras &&
                pool.upsell_extras!
                  .filter((e) => selectedUpsells.has(e.id))
                  .map((e) => (
                    <div
                      key={e.id}
                      className="flex justify-between text-xs text-slate-500"
                    >
                      <span>{e.name}</span>
                      <span>+ R$ {e.price}</span>
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

          {/* ===== Step 5: WhatsApp CTA ===== */}
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
