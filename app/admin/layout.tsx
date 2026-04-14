import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Painel do Proprietário | AlugueSuaPiscina",
  description: "Gerencie sua piscina e reservas.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
