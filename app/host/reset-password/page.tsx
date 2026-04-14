"use client";

import { useState, useTransition } from "react";
import { Waves, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { updatePassword } from "./actions";

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePassword(formData);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -left-4 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-20 w-96 h-96 bg-cyan-200/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-0 shadow-xl shadow-sky-200/40 bg-white/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-lg shadow-sky-300/50">
              <Waves className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            Criar nova senha
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Escolha uma nova senha para sua conta
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium text-sm">
                Nova senha (mínimo 6 caracteres)
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  disabled={isPending}
                  minLength={6}
                  className="h-11 pr-10 bg-white/70 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium text-sm">
                Confirmar nova senha
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                disabled={isPending}
                minLength={6}
                className="h-11 bg-white/70 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-11 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-sky-300/40 transition-all duration-200"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Salvar nova senha
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
