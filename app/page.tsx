import Link from "next/link";
import { Waves, Search, LogIn, PlusCircle } from "lucide-react";
import { PoolCard } from "@/components/pool-card";
import { createClient } from "@/lib/supabase/server";
import type { PoolPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const { data: pools, error } = await supabase
    .from("public_pools")
    .select("*")
    .order("created_at", { ascending: false });

  const poolList = (pools as PoolPublic[] | null) ?? [];

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400 shadow-md shadow-sky-300/30">
              <Waves className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent hidden sm:inline">
              AlugueSuaPiscina
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search hint (future) */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 text-slate-400 text-sm cursor-default">
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Buscar piscinas...</span>
            </div>

            {/* Host Login CTA — always visible */}
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Anunciar piscina</span>
              <span className="sm:hidden">Anunciar</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 text-white">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-300/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-400/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium mb-4">
            🏊‍♂️ Day Use de piscinas na sua cidade
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 leading-tight">
            Alugue piscinas incríveis
            <br />
            <span className="text-sky-200">por dia, sem burocracia</span>
          </h1>
          <p className="text-sky-100 text-sm sm:text-base max-w-lg mx-auto mb-6">
            Encontre piscinas perto de você, escolha sua data e reserve direto
            pelo WhatsApp. Sem cadastro, sem complicação.
          </p>

          {/* Dual CTA — Guest vs Host */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#piscinas"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-sky-600 font-bold text-sm shadow-lg shadow-sky-700/20 hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <Search className="h-4 w-4" />
              Ver piscinas disponíveis
            </a>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 backdrop-blur-sm text-white font-medium text-sm border border-white/30 hover:bg-white/25 transition-all duration-200"
            >
              <PlusCircle className="h-4 w-4" />
              Quero anunciar minha piscina
            </Link>
          </div>
        </div>
      </section>

      {/* Pool Grid */}
      <main id="piscinas" className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm">
              Erro ao carregar piscinas. Tente novamente mais tarde.
            </p>
          </div>
        )}

        {!error && poolList.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏖️</div>
            <h2 className="text-xl font-bold text-slate-700 mb-2">
              Nenhuma piscina disponível ainda
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Em breve teremos piscinas incríveis cadastradas na sua região.
            </p>

            {/* Host CTA in empty state */}
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500 text-white font-semibold text-sm shadow-md hover:bg-sky-600 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Seja o primeiro a anunciar
            </Link>
          </div>
        )}

        {!error && poolList.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">
                {poolList.length} piscina{poolList.length > 1 ? "s" : ""}{" "}
                disponíve{poolList.length > 1 ? "is" : "l"}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {poolList.map((pool) => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-semibold text-slate-500">
              AlugueSuaPiscina
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/login"
              className="text-xs text-slate-400 hover:text-sky-500 transition-colors"
            >
              Área do Anunciante
            </Link>
            <span className="text-slate-200">|</span>
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} AlugueSuaPiscina
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
