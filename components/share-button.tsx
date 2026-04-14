"use client";

import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ShareButtonProps {
  poolTitle: string;
  poolUrl: string;
}

export function ShareButton({ poolTitle, poolUrl }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareText = `Olha essa piscina: ${poolTitle}! ${poolUrl} 🏊‍♂️`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `🏊 ${poolTitle}`,
          text: shareText,
          url: poolUrl,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <button
      onClick={handleShare}
      className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors active:scale-95"
      aria-label="Compartilhar"
    >
      {copied ? (
        <Check className="h-5 w-5 text-emerald-500" />
      ) : (
        <Share2 className="h-5 w-5" />
      )}
    </button>
  );
}
