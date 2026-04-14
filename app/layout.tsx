import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlugueSuaPiscina – Aluguel de piscinas por dia",
  description:
    "Encontre e alugue piscinas incríveis por dia na sua cidade. Sem cadastro, sem complicação. Reserve via WhatsApp!",
  keywords: ["aluguel piscina", "piscina por dia", "alugar piscina", "day use piscina"],
  openGraph: {
    title: "AlugueSuaPiscina – Aluguel de piscinas por dia",
    description:
      "Encontre e alugue piscinas incríveis por dia na sua cidade. Reserve via WhatsApp!",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FAFAFA] text-[#1F2937] font-[family-name:var(--font-inter)]">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
