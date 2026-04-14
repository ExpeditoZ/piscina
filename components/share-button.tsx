"use client";

import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

interface ShareButtonProps {
  poolTitle: string;
  poolUrl: string;
}

export function ShareButton({ poolTitle, poolUrl }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareText = `Galera, achei essa piscina INCRÍVEL pro nosso fim de semana! Olha as fotos: ${poolUrl}. Bora rachar?? 🏊‍♂️🔥`;

  async function handleShare() {
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `🏊 ${poolTitle}`,
          text: shareText,
          url: poolUrl,
        });
        return;
      } catch (err) {
        // User cancelled share — fall through to clipboard
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Link copiado! Envie para o grupo 🎉");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <Button
      onClick={handleShare}
      variant="outline"
      className="w-full h-11 border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 font-semibold transition-all duration-200 group"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2 text-emerald-500" />
          Copiado!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
          💸 Rachar com a Galera
        </>
      )}
    </Button>
  );
}
