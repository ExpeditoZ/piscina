"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Waves, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.success) {
        setEmailSent(true);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -left-4 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-20 w-96 h-96 bg-cyan-200/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      <Link
        href="/host/login"
        className="fixed top-4 left-4 z-20 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao login
      </Link>

      <Card className="w-full max-w-md relative z-10 border-0 shadow-xl shadow-sky-200/40 bg-white/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-lg shadow-sky-300/50">
              <Waves className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            Recuperar senha
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enviaremos um link para redefinir sua senha
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          {emailSent ? (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex p-3 rounded-full bg-emerald-50">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                E-mail enviado
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Se o e-mail estiver cadastrado, você receberá um link
                de recuperação em breve. Verifique sua caixa de entrada e spam.
              </p>
              <Link
                href="/host/login"
                className="inline-flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-600 font-semibold transition-colors mt-2"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form action={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium text-sm">
                  E-mail cadastrado
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

              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-sky-300/40 transition-all duration-200"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar link de recuperação
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
