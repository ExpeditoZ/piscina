"use server";

import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Informe seu e-mail." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/host/reset-password`,
  });

  if (error) {
    if (error.message.includes("rate limit")) {
      return { error: "Muitas tentativas. Aguarde alguns minutos." };
    }
    return { error: `Erro: ${error.message}` };
  }

  // Always return success (don't reveal if email exists)
  return {
    success: true,
    message: "Se o e-mail estiver cadastrado, você receberá um link de recuperação.",
  };
}
