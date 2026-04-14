"use client";

import { useState, useTransition } from "react";
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MapPin,
  DollarSign,
  Clock,
  ShoppingBag,
  ScrollText,
  MessageCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { upsertPool, type PoolFormData } from "./actions";
import { PhotoUploader } from "./photo-uploader";
import type { Pool, ShiftOption, UpsellExtra } from "@/lib/types";

interface PoolFormProps {
  pool: Pool | null;
}

export function PoolForm({ pool }: PoolFormProps) {
  const [isPending, startTransition] = useTransition();

  // Basic info
  const [title, setTitle] = useState(pool?.title ?? "");
  const [neighborhood, setNeighborhood] = useState(pool?.neighborhood ?? "");
  const [city, setCity] = useState(pool?.city ?? "São Paulo");
  const [exactAddress, setExactAddress] = useState(pool?.exact_address ?? "");
  const [lockboxInstructions, setLockboxInstructions] = useState(
    pool?.key_lockbox_instructions ?? ""
  );
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(
    pool?.owner_whatsapp ?? ""
  );

  // Photos
  const [photos, setPhotos] = useState<string[]>(pool?.photos ?? []);

  // Pricing
  const [weekdayPrice, setWeekdayPrice] = useState(
    pool?.pricing?.weekday ?? 300
  );
  const [weekendPrice, setWeekendPrice] = useState(
    pool?.pricing?.weekend ?? 500
  );

  // Shifts config
  const [shiftsEnabled, setShiftsEnabled] = useState(
    pool?.shifts_config?.enabled ?? false
  );
  const [shifts, setShifts] = useState<ShiftOption[]>(
    pool?.shifts_config?.options ?? [
      { name: "Manhã (8h-15h)", price: 250 },
      { name: "Noite (16h-23h)", price: 300 },
    ]
  );

  // Rules
  const [hasRules, setHasRules] = useState(!!pool?.rules);
  const [rules, setRules] = useState(pool?.rules ?? "");

  // Upsell extras
  const [hasUpsells, setHasUpsells] = useState(
    !!pool?.upsell_extras && pool.upsell_extras.length > 0
  );
  const [upsells, setUpsells] = useState<UpsellExtra[]>(
    pool?.upsell_extras ?? [
      { id: "1", name: "Saco de Gelo", price: 20 },
    ]
  );

  // Telegram
  const [telegramChatId, setTelegramChatId] = useState(
    pool?.telegram_chat_id ?? ""
  );

  // --- Shift Handlers ---
  function addShift() {
    setShifts([...shifts, { name: "", price: 0 }]);
  }
  function removeShift(index: number) {
    setShifts(shifts.filter((_, i) => i !== index));
  }
  function updateShift(index: number, field: keyof ShiftOption, value: string | number) {
    const updated = [...shifts];
    if (field === "price") {
      updated[index] = { ...updated[index], price: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], name: String(value) };
    }
    setShifts(updated);
  }

  // --- Upsell Handlers ---
  function addUpsell() {
    const newId = String(Date.now());
    setUpsells([...upsells, { id: newId, name: "", price: 0 }]);
  }
  function removeUpsell(index: number) {
    setUpsells(upsells.filter((_, i) => i !== index));
  }
  function updateUpsell(index: number, field: keyof UpsellExtra, value: string | number) {
    const updated = [...upsells];
    if (field === "price") {
      updated[index] = { ...updated[index], price: Number(value) || 0 };
    } else if (field === "name") {
      updated[index] = { ...updated[index], name: String(value) };
    } else {
      updated[index] = { ...updated[index], id: String(value) };
    }
    setUpsells(updated);
  }

  // --- Submit ---
  function handleSubmit() {
    if (!title.trim()) {
      toast.error("O título da piscina é obrigatório.");
      return;
    }
    if (!neighborhood.trim()) {
      toast.error("O bairro é obrigatório.");
      return;
    }

    const formData: PoolFormData = {
      title: title.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      exact_address: exactAddress.trim(),
      key_lockbox_instructions: lockboxInstructions.trim(),
      owner_whatsapp: ownerWhatsapp.trim(),
      photos,
      pricing: { weekday: weekdayPrice, weekend: weekendPrice },
      shifts_config: shiftsEnabled
        ? { enabled: true, options: shifts.filter((s) => s.name.trim()) }
        : null,
      rules: hasRules && rules.trim() ? rules.trim() : null,
      upsell_extras:
        hasUpsells && upsells.length > 0
          ? upsells.filter((u) => u.name.trim())
          : null,
      telegram_chat_id: telegramChatId.trim() || null,
    };

    startTransition(async () => {
      const result = await upsertPool(pool?.id ?? null, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          pool ? "Piscina atualizada com sucesso!" : "Piscina criada com sucesso!"
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Basic Info */}
      <Card className="border-0 shadow-md shadow-slate-200/60 bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <MapPin className="h-4 w-4 text-sky-500" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-slate-700">
              Título do anúncio *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Piscina Premium com Churrasqueira"
              className="h-10 bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="neighborhood" className="text-sm font-medium text-slate-700">
                Bairro *
              </Label>
              <Input
                id="neighborhood"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Vila Mariana"
                className="h-10 bg-slate-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium text-slate-700">
                Cidade
              </Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="São Paulo"
                className="h-10 bg-slate-50/50"
              />
            </div>
          </div>

          <Separator className="my-2" />

          <div className="space-y-2">
            <Label htmlFor="exact_address" className="text-sm font-medium text-slate-700">
              Endereço completo
              <span className="text-xs text-slate-400 ml-1">(revelado após confirmação)</span>
            </Label>
            <Input
              id="exact_address"
              value={exactAddress}
              onChange={(e) => setExactAddress(e.target.value)}
              placeholder="Rua das Palmeiras, 123 - Vila Mariana"
              className="h-10 bg-slate-50/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lockbox" className="text-sm font-medium text-slate-700">
              Instruções do cofre/chave
              <span className="text-xs text-slate-400 ml-1">(revelado após confirmação)</span>
            </Label>
            <Input
              id="lockbox"
              value={lockboxInstructions}
              onChange={(e) => setLockboxInstructions(e.target.value)}
              placeholder="Cofre na portaria, código 1234"
              className="h-10 bg-slate-50/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="text-sm font-medium text-slate-700">
              WhatsApp (com DDD)
            </Label>
            <Input
              id="whatsapp"
              value={ownerWhatsapp}
              onChange={(e) => setOwnerWhatsapp(e.target.value)}
              placeholder="5511999999999"
              className="h-10 bg-slate-50/50"
            />
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Formato internacional sem espaços: 55 + DDD + número
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Photos */}
      <Card className="border-0 shadow-md shadow-slate-200/60 bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            📸 Fotos da Piscina
          </CardTitle>
          <p className="text-xs text-slate-400 mt-1">
            As imagens são comprimidas automaticamente para economizar espaço (máx. 150KB cada).
          </p>
        </CardHeader>
        <CardContent>
          <PhotoUploader
            photos={photos}
            onPhotosChange={setPhotos}
            poolId={pool?.id}
          />
        </CardContent>
      </Card>

      {/* Section 3: Pricing */}
      <Card className="border-0 shadow-md shadow-slate-200/60 bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Preços
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Dia de semana (R$)
              </Label>
              <Input
                type="number"
                value={weekdayPrice}
                onChange={(e) => setWeekdayPrice(Number(e.target.value) || 0)}
                min={0}
                className="h-10 bg-slate-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Final de semana (R$)
              </Label>
              <Input
                type="number"
                value={weekendPrice}
                onChange={(e) => setWeekendPrice(Number(e.target.value) || 0)}
                min={0}
                className="h-10 bg-slate-50/50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Shifts */}
      <Card className="border-0 shadow-md shadow-slate-200/60 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Clock className="h-4 w-4 text-amber-500" />
              Turnos (Opcional)
            </CardTitle>
            <button
              type="button"
              onClick={() => setShiftsEnabled(!shiftsEnabled)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              {shiftsEnabled ? (
                <ToggleRight className="h-6 w-6 text-sky-500" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-slate-300" />
              )}
              {shiftsEnabled ? "Ativado" : "Desativado"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Permite que hóspedes escolham um turno em vez do dia inteiro.
          </p>
        </CardHeader>
        {shiftsEnabled && (
          <CardContent className="space-y-3">
            {shifts.map((shift, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input
                  value={shift.name}
                  onChange={(e) => updateShift(i, "name", e.target.value)}
                  placeholder="Nome do turno"
                  className="flex-1 h-9 bg-slate-50/50 text-sm"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">R$</span>
                  <Input
                    type="number"
                    value={shift.price}
                    onChange={(e) => updateShift(i, "price", e.target.value)}
                    min={0}
                    className="w-24 h-9 bg-slate-50/50 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeShift(i)}
                  className="h-9 w-9 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addShift}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar turno
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Section 5: Rules */}
      <Card className="border-0 shadow-md shadow-slate-200/60 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <ScrollText className="h-4 w-4 text-purple-500" />
              Regras (Opcional)
            </CardTitle>
            <button
              type="button"
              onClick={() => setHasRules(!hasRules)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              {hasRules ? (
                <ToggleRight className="h-6 w-6 text-sky-500" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-slate-300" />
              )}
              {hasRules ? "Ativado" : "Desativado"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Se ativado, o hóspede deve aceitar as regras antes de reservar.
          </p>
        </CardHeader>
        {hasRules && (
          <CardContent>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Proibido garrafas de vidro. Máximo 15 pessoas. Respeitar horário de silêncio após 22h."
              rows={3}
              className="w-full p-3 text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20 outline-none transition-all resize-none"
            />
          </CardContent>
        )}
      </Card>

      {/* Section 6: Upsell Extras */}
      <Card className="border-0 shadow-md shadow-slate-200/60 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <ShoppingBag className="h-4 w-4 text-orange-500" />
              Extras para venda (Opcional)
            </CardTitle>
            <button
              type="button"
              onClick={() => setHasUpsells(!hasUpsells)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              {hasUpsells ? (
                <ToggleRight className="h-6 w-6 text-sky-500" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-slate-300" />
              )}
              {hasUpsells ? "Ativado" : "Desativado"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Itens adicionais que o hóspede pode escolher no checkout.
          </p>
        </CardHeader>
        {hasUpsells && (
          <CardContent className="space-y-3">
            {upsells.map((upsell, i) => (
              <div key={upsell.id} className="flex items-center gap-3">
                <Input
                  value={upsell.name}
                  onChange={(e) => updateUpsell(i, "name", e.target.value)}
                  placeholder="Nome do extra"
                  className="flex-1 h-9 bg-slate-50/50 text-sm"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">R$</span>
                  <Input
                    type="number"
                    value={upsell.price}
                    onChange={(e) => updateUpsell(i, "price", e.target.value)}
                    min={0}
                    className="w-24 h-9 bg-slate-50/50 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeUpsell(i)}
                  className="h-9 w-9 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addUpsell}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar extra
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Section 7: Telegram */}
      <Card className="border-0 shadow-md shadow-slate-200/60 bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            Notificações via Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="telegram" className="text-sm font-medium text-slate-700">
              Chat ID do Telegram
            </Label>
            <Input
              id="telegram"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Ex: 123456789"
              className="h-10 bg-slate-50/50"
            />
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Como obter seu Chat ID:</strong> Abra o Telegram, busque nosso Bot,
              envie <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800">/start</code>{" "}
              e o bot irá retornar seu Chat ID. Cole-o aqui para receber
              notificações de reservas.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="sticky bottom-4 z-40">
        <Button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full h-12 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold text-base shadow-xl shadow-sky-300/40 transition-all duration-200 hover:shadow-2xl hover:shadow-sky-300/50 rounded-xl"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              {pool ? "Salvar Alterações" : "Criar Piscina"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
