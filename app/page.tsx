import Link from "next/link";
import { cookies } from "next/headers";
import {
  Waves,
  Search,
  PlusCircle,
  MapPin,
  Calendar,
  MessageCircle,
  DollarSign,
  Shield,
  Zap,
  ChevronRight,
  Star,
} from "lucide-react";
import { PoolCard } from "@/components/pool-card";
import { CitySelector } from "@/components/city-selector";
import { createClient } from "@/lib/supabase/server";
import type { PoolPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ city?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // Resolve city preference: query param > cookie > null
  const cookieStore = await cookies();
  const citySlug = params.city || cookieStore.get("preferred_city")?.value || null;

  // Fetch pools from public_pools view
  const { data: pools, error } = await supabase
    .from("public_pools")
    .select("*")
    .order("created_at", { ascending: false });

  const allPools = (pools as PoolPublic[] | null) ?? [];

  // Categorize pools by location context
  let cityPools: PoolPublic[] = [];
  let regionPools: PoolPublic[] = [];
  let otherPools: PoolPublic[] = [];
  let cityName: string | null = null;
  let regionName: string | null = null;

  if (citySlug) {
    for (const p of allPools) {
      if (p.city_slug === citySlug) {
        cityPools.push(p);
        if (!cityName) cityName = p.city_name;
        if (!regionName) regionName = p.region_name;
      } else if (
        p.region_slug &&
        allPools.some(
          (cp) => cp.city_slug === citySlug && cp.region_slug === p.region_slug
        )
      ) {
        regionPools.push(p);
        if (!regionName) regionName = p.region_name;
      } else {
        otherPools.push(p);
      }
    }
  }

  const hasCity = citySlug && (cityPools.length > 0 || regionPools.length > 0);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ====== HEADER ====== */}
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

          <div className="flex items-center gap-2.5">
            {/* City Selector */}
            <CitySelector currentCitySlug={citySlug} compact />

            {/* Host CTA */}
            <Link
              href="/host/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Anunciar piscina</span>
              <span className="sm:hidden">Anunciar</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ====== HERO ====== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 text-white">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-300/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium mb-4">
            🏊‍♂️ {cityName ? `Piscinas em ${cityName}` : "Day Use de piscinas na sua cidade"}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 leading-tight">
            {cityName ? (
              <>
                Piscinas incríveis
                <br />
                <span className="text-sky-200">em {cityName}</span>
              </>
            ) : (
              <>
                Alugue piscinas incríveis
                <br />
                <span className="text-sky-200">por dia, sem burocracia</span>
              </>
            )}
          </h1>
          <p className="text-sky-100 text-sm sm:text-base max-w-lg mx-auto mb-6">
            Encontre piscinas perto de você, escolha sua data e reserve direto
            pelo WhatsApp. Sem cadastro, sem complicação.
          </p>

          {/* Dual CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#piscinas"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-sky-600 font-bold text-sm shadow-lg shadow-sky-700/20 hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <Search className="h-4 w-4" />
              Ver piscinas disponíveis
            </a>
            <Link
              href="/host/signup"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 backdrop-blur-sm text-white font-medium text-sm border border-white/30 hover:bg-white/25 transition-all duration-200"
            >
              <PlusCircle className="h-4 w-4" />
              Quero anunciar minha piscina
            </Link>
          </div>
        </div>
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-sky-50 flex-shrink-0">
                <Search className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Encontre</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Piscinas perto de você com fotos, preços e disponibilidade
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 flex-shrink-0">
                <Calendar className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Escolha a data</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dia inteiro, turno ou período de vários dias
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-green-50 flex-shrink-0">
                <MessageCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Reserve via WhatsApp</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sem cadastro, sem cartão. Combine direto com o dono
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== POOL GRID ====== */}
      <main id="piscinas" className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm">
              Erro ao carregar piscinas. Tente novamente mais tarde.
            </p>
          </div>
        )}

        {!error && allPools.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏖️</div>
            <h2 className="text-xl font-bold text-slate-700 mb-2">
              Nenhuma piscina disponível ainda
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Em breve teremos piscinas incríveis cadastradas na sua região.
            </p>
            <Link
              href="/host/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500 text-white font-semibold text-sm shadow-md hover:bg-sky-600 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Seja o primeiro a anunciar
            </Link>
          </div>
        )}

        {!error && allPools.length > 0 && (
          <>
            {/* LOCATION-BASED SECTIONS */}
            {hasCity ? (
              <>
                {/* City section */}
                {cityPools.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="h-4 w-4 text-sky-500" />
                      <h2 className="text-lg font-bold text-slate-800">
                        Em {cityName}
                      </h2>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {cityPools.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {cityPools.map((pool) => (
                        <PoolCard key={pool.id} pool={pool} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Region section */}
                {regionPools.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="h-4 w-4 text-amber-500" />
                      <h2 className="text-lg font-bold text-slate-800">
                        Na região de {regionName}
                      </h2>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {regionPools.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {regionPools.map((pool) => (
                        <PoolCard key={pool.id} pool={pool} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Other regions */}
                {otherPools.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-bold text-slate-800">
                        Outras regiões
                      </h2>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {otherPools.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {otherPools.map((pool) => (
                        <PoolCard key={pool.id} pool={pool} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              /* NO CITY SELECTED — show all flat */
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-slate-800">
                    {allPools.length} piscina{allPools.length > 1 ? "s" : ""}{" "}
                    disponíve{allPools.length > 1 ? "is" : "l"}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allPools.map((pool) => (
                    <PoolCard key={pool.id} pool={pool} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ====== HOST VALUE PROPOSITION ====== */}
      <section className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left: Message */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                <DollarSign className="h-3 w-3" />
                Ganhe dinheiro com sua piscina
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">
                Sua piscina pode ser
                <br />
                <span className="text-emerald-400">a próxima do catálogo</span>
              </h2>
              <p className="text-slate-400 text-sm sm:text-base max-w-md mb-6">
                Cadastre em minutos, defina seus preços, e comece a receber
                reservas sem complicação. Tudo pelo celular.
              </p>
              <Link
                href="/host/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all hover:scale-105"
              >
                Anunciar minha piscina
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Right: Feature grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Star, label: "Anúncio público", desc: "Visível para todos" },
                { icon: Calendar, label: "Calendário", desc: "Turnos, diárias, períodos" },
                { icon: MessageCircle, label: "WhatsApp", desc: "Reserva sem intermediário" },
                { icon: Zap, label: "Telegram", desc: "Alertas instantâneos" },
                { icon: Shield, label: "Sem comissão", desc: "100% da reserva é sua" },
                { icon: DollarSign, label: "R$ 49,90/mês", desc: "Plano simples e justo" },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
                >
                  <Icon className="h-4 w-4 text-sky-400 mb-2" />
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-[11px] text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-semibold text-slate-500">
              AlugueSuaPiscina
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/host/login"
              className="text-xs text-slate-400 hover:text-sky-500 transition-colors"
            >
              Área do Anunciante
            </Link>
            <span className="text-slate-200">|</span>
            <Link
              href="/host/signup"
              className="text-xs text-slate-400 hover:text-sky-500 transition-colors"
            >
              Anunciar piscina
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
