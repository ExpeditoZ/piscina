import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Área do Anunciante | AlugueSuaPiscina",
  description: "Gerencie sua piscina, reservas e assinatura.",
};

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
