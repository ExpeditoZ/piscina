// ==============================
// Database Types for AlugueSuaPiscina
// ==============================

export interface ShiftOption {
  name: string;
  price: number;
}

export interface ShiftsConfig {
  enabled: boolean;
  options: ShiftOption[];
}

export interface Pricing {
  weekday: number;
  weekend: number;
}

export interface UpsellExtra {
  id: string;
  name: string;
  price: number;
}

export type PoolStatus = "draft" | "pending_subscription" | "active" | "suspended";

export interface Pool {
  id: string;
  owner_id: string;
  title: string;
  neighborhood: string;
  city: string;
  exact_address: string | null;
  key_lockbox_instructions: string | null;
  owner_whatsapp: string | null;
  photos: string[];
  pricing: Pricing;
  shifts_config: ShiftsConfig | null;
  rules: string | null;
  upsell_extras: UpsellExtra[] | null;
  telegram_chat_id: string | null;
  status: PoolStatus;
  created_at: string;
  updated_at: string;
}

// Public-safe version of Pool (no private fields)
export interface PoolPublic {
  id: string;
  title: string;
  neighborhood: string;
  city: string;
  photos: string[];
  pricing: Pricing;
  shifts_config: ShiftsConfig | null;
  rules: string | null;
  upsell_extras: UpsellExtra[] | null;
}

export type BookingStatus = "negotiating" | "confirmed" | "cancelled";

export interface SelectedUpsell {
  id: string;
  name: string;
  price: number;
}

export interface Booking {
  id: string;
  pool_id: string;
  guest_name: string;
  arrival_time: string;
  booking_date: string;
  shift_selected: string | null;
  total_price: number;
  selected_upsells: SelectedUpsell[] | null;
  status: BookingStatus;
  created_at: string;
}

// Minimal booking data exposed publicly (for calendar rendering)
export interface BookingCalendar {
  booking_date: string;
  status: BookingStatus;
}

// Weather data from Open-Meteo
export interface WeatherDay {
  date: string;
  weatherCode: number;
  temperatureMax: number;
}
