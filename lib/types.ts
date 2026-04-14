// ==============================
// Database Types for AlugueSuaPiscina
// ==============================

// ---- Booking Modes ----
export type BookingMode = "shift" | "full_day" | "range";

// ---- Shift Config (per pool) ----
export interface ShiftOption {
  name: string;
  price: number;
}

export interface ShiftsConfig {
  enabled: boolean;
  options: ShiftOption[];
}

// ---- Pricing ----
export interface Pricing {
  weekday: number;
  weekend: number;
}

// ---- Pricing Breakdown (stored with each booking) ----
export interface PricingDayLine {
  date: string;
  price: number;
  type: "weekday" | "weekend";
}

export interface PricingExtraLine {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface PricingBreakdown {
  mode: BookingMode;
  days: PricingDayLine[];
  shiftName?: string;
  shiftPrice?: number;
  subtotalBase: number;
  extras: PricingExtraLine[];
  subtotalExtras: number;
  total: number;
}

// ---- Extras ----
export type ExtraBilling = "per_reservation" | "per_day";

export interface UpsellExtra {
  id: string;
  name: string;
  price: number;
  billing?: ExtraBilling; // default: "per_reservation"
}

// ---- Geography ----
export interface Region {
  id: string;
  name: string;
  slug: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  sort_order: number;
}

export interface City {
  id: string;
  region_id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

// ---- Pool ----
export type PoolStatus = "draft" | "pending_subscription" | "active" | "suspended";

export interface Pool {
  id: string;
  owner_id: string;
  title: string;
  neighborhood: string;
  city: string;
  city_id: string | null;
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

// Public-safe version of Pool (from public_pools view)
export interface PoolPublic {
  id: string;
  title: string;
  neighborhood: string;
  city: string;
  city_id: string | null;
  city_name: string | null;
  city_slug: string | null;
  city_latitude: number | null;
  city_longitude: number | null;
  region_id: string | null;
  region_name: string | null;
  region_slug: string | null;
  photos: string[];
  pricing: Pricing;
  shifts_config: ShiftsConfig | null;
  rules: string | null;
  upsell_extras: UpsellExtra[] | null;
}

// ---- Booking ----
export type BookingStatus = "negotiating" | "confirmed" | "cancelled";

export interface SelectedUpsell {
  id: string;
  name: string;
  price: number;
  billing?: ExtraBilling;
  quantity?: number;
  total?: number;
}

export interface Booking {
  id: string;
  pool_id: string;
  guest_name: string;
  arrival_time: string;
  booking_mode: BookingMode;
  booking_date: string;
  start_date: string;
  end_date: string;
  total_days: number;
  shift_selected: string | null;
  total_price: number;
  pricing_breakdown: PricingBreakdown | null;
  selected_upsells: SelectedUpsell[] | null;
  status: BookingStatus;
  created_at: string;
}

// ---- Calendar data (expanded view — one row per date) ----
export interface BookingCalendar {
  booking_date: string;
  shift_selected: string | null;
  booking_mode: string;
  status: BookingStatus;
}

// ---- Booking Selection (UI state between calendar → checkout) ----
export interface BookingSelection {
  mode: BookingMode;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  shiftSelected: string | null;
  basePrice: number;        // before extras
}

// ---- Weather ----
export interface WeatherDay {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
}
