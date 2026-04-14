"use server";

import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!name || !email || !password || !confirmPassword) {
    return { error: "Preencha todos os campos." };
  }

  if (password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name.trim(),
      },
      emailRedirectTo: `${appUrl}/auth/callback?next=/host/dashboard`,
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "Este e-mail já está cadastrado. Faça login." };
    }
    if (error.message.includes("rate limit")) {
      return { error: "Muitas tentativas. Aguarde alguns minutos." };
    }
    return { error: `Erro ao criar conta: ${error.message}` };
  }

  return { 
    success: true,
    message: "Conta criada! Verifique seu e-mail para confirmar o cadastro." 
  };
}
