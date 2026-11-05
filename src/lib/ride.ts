export type Ride = {
  id: string;
  status: string;
  price: number;
  distance_km: number;
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string;
  dest_lat: number;
  dest_lng: number;
  dest_label: string;
  offered_price?: number | null;
  payment_method?: string | null;
  updated_at?: string;
  passenger_phone?: string;
  passenger_name?: string;
  driver_phone?: string | null;
  driver_name?: string | null;
  driver_id?: string | null;
  passenger_id?: string | null;
};

export type DriverInfo = {
  name?: string | null;
  phone?: string | null;
  car_model?: string | null;
  car_color?: string | null;
  plate?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type Me = {
  id: string;
  phone: string;
  name: string;
  role: string;
  driver?: {
    approved?: boolean;
    car_model?: string | null;
    car_color?: string | null;
    plate?: string | null;
  } | null;
};

export function fareOf(ride: { price: number; offered_price?: number | null }): number {
  const n = Number(ride.offered_price || ride.price);
  return Number.isFinite(n) ? n : 0;
}

export function isLive(status: string | undefined | null): boolean {
  return status === "requested" || status === "accepted" || status === "arrived";
}

export const QPAY_KEY = (id: string) => `dt-qpay-${id}`;
export const RIDE_KEY = "dt-ride";
