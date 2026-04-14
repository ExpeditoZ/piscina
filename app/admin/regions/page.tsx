import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminRegions() {
  const supabase = createAdminClient();

  const { data: regions } = await supabase
    .from("regions")
    .select("*")
    .order("sort_order");

  const { data: cities } = await supabase
    .from("cities")
    .select("*")
    .order("name");

  const { data: poolCounts } = await supabase
    .from("pools")
    .select("city_id");

  // Count pools per city
  const cityPoolCount = new Map<string, number>();
  for (const p of poolCounts || []) {
    if (p.city_id) {
      cityPoolCount.set(p.city_id, (cityPoolCount.get(p.city_id) || 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Regiões e Cidades</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gerencie a cobertura geográfica da plataforma
        </p>
      </div>

      {(regions || []).map((region) => {
        const regionCities = (cities || []).filter(
          (c) => c.region_id === region.id
        );

        return (
          <Card key={region.id} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-rose-50">
                  <MapPin className="h-4 w-4 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">{region.name}</h2>
                  <p className="text-[11px] text-slate-400">
                    {region.state} · slug: {region.slug} · {regionCities.length} cidades
                  </p>
                </div>
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    region.is_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {region.is_active ? "Ativa" : "Inativa"}
                </span>
              </div>

              <div className="mt-2 divide-y divide-slate-50">
                {regionCities.map((city) => (
                  <div key={city.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-slate-700 font-medium">{city.name}</p>
                      <p className="text-[10px] text-slate-400">
                        slug: {city.slug}
                        {city.latitude && ` · ${city.latitude.toFixed(4)}, ${city.longitude?.toFixed(4)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {cityPoolCount.get(city.id) || 0} piscinas
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          city.is_active ? "bg-emerald-400" : "bg-slate-300"
                        }`}
                      />
                    </div>
                  </div>
                ))}
                {regionCities.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    Nenhuma cidade cadastrada nesta região.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {(!regions || regions.length === 0) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhuma região cadastrada.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
