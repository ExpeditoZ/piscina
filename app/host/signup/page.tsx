"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Waves, UserPlus, Loader2, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { signUp } from "./actions";

export default function HostSignupPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.success) {
        setEmailSent(true);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 px-4 py-8">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -left-4 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-20 w-96 h-96 bg-cyan-200/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-blue-200/25 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      {/* Back */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-20 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <Card className="w-full max-w-md relative z-10 border-0 shadow-xl shadow-sky-200/40 bg-white/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-lg shadow-sky-300/50">
              <Waves className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
              AlugueSuaPiscina
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Criar conta de anunciante
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          {emailSent ? (
            /* Success state */
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex p-3 rounded-full bg-emerald-50">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                Verifique seu e-mail
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Enviamos um link de confirmação para o seu e-mail.
                Clique no link para ativar sua conta e começar a
                anunciar sua piscina.
              </p>
              <Link
                href="/host/login"
                className="inline-flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-600 font-semibold transition-colors mt-2"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            /* Signup form */
            <>
              <form action={handleSubmit} className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700 font-medium text-sm">
                    Nome completo
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Seu nome"
                    required
                    disabled={isPending}
                    className="h-11 bg-white/70 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 transition-all"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium text-sm">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    disabled={isPending}
                    className="h-11 bg-white/70 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 transition-all"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">
                    Senha (mínimo 6 caracteres)
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

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700 font-medium text-sm">
                    Confirmar senha
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

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-11 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-sky-300/40 transition-all duration-200 hover:shadow-xl"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Criar conta
                    </>
                  )}
                </Button>
              </form>

              {/* Login link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  Já tem uma conta?{" "}
                  <Link
                    href="/host/login"
                    className="text-sky-500 hover:text-sky-600 font-semibold transition-colors"
                  >
                    Fazer login
                  </Link>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
