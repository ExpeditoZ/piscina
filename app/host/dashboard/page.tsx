import { Waves, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOwnerPool, signOut } from "./actions";
import { PoolForm } from "./pool-form";

export default async function HostDashboard() {
  const pool = await getOwnerPool();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-cyan-50/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400 shadow-md shadow-sky-300/30">
              <Waves className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
              Painel
            </span>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              Sair
            </Button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {!pool ? (
          /* No pool yet — Show welcome + form */
          <div className="space-y-8">
            {/* Welcome Card */}
            <Card className="border-0 shadow-lg shadow-sky-100/50 bg-gradient-to-br from-white to-sky-50/50 overflow-hidden">
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-xl shadow-sky-300/40 mb-5">
                  <Plus className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  Cadastre sua piscina
                </h2>
                <p className="text-slate-500 max-w-md mx-auto">
                  Preencha as informações abaixo para criar seu anúncio.
                  Você só precisa fazer isso uma vez — depois, gerencie
                  tudo pelo Telegram!
                </p>
              </CardContent>
            </Card>

            {/* Pool Form */}
            <PoolForm pool={null} />
          </div>
        ) : (
          /* Has pool — Show form in edit mode */
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 shadow-lg shadow-emerald-300/40">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {pool.title}
                </h2>
                <p className="text-sm text-slate-500">
                  Edite as configurações da sua piscina
                </p>
              </div>
            </div>

            <PoolForm pool={pool} />
          </div>
        )}
      </main>
    </div>
  );
}
