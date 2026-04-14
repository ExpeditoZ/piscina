import Link from "next/link";
import { redirect } from "next/navigation";
import { Waves, LayoutDashboard, MapPin, Users, Home as HomeIcon, CalendarCheck, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Admin email whitelist — add your admin emails here
const ADMIN_EMAILS = ["pedro@gmail.com"];

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    redirect("/");
  }
  return user;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAdmin();

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Visão Geral" },
    { href: "/admin/regions", icon: MapPin, label: "Regiões" },
    { href: "/admin/hosts", icon: Users, label: "Hosts" },
    { href: "/admin/pools", icon: HomeIcon, label: "Piscinas" },
    { href: "/admin/bookings", icon: CalendarCheck, label: "Reservas" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-sky-500">
              <Waves className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm">Admin Panel</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Link>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden sticky top-14 z-40 bg-white border-b border-slate-200 overflow-x-auto">
        <div className="flex items-center gap-1 px-3 py-2">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 whitespace-nowrap transition-colors"
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
