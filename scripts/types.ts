export type DataSource = "live" | "github" | "pi" | "sample";

export type DataStatus = "live" | "backup" | "stale" | "sample";

export interface Vehicle {
  vehicle_id: string;
  operator: string;
  operator_code: string;
  route: string;
  direction: string;
  origin: string;
  destination: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed_mps: number;
  occupancy: string;
  recorded_at: string;
  journey_id: string;
}

export interface VehicleHistory {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

export interface BusData {
  schema_version: 1;
  generated_at: string;
  source: DataSource;
  status: DataStatus;
  data_age_seconds: number;
  vehicle_count: number;
  vehicles: Vehicle[];
}

export interface StatusData {
  schema_version: 1;
  status: DataStatus;
  source: DataSource;
  generated_at: string;
  checked_at: string;
  data_age_seconds: number;
  vehicle_count: number;
  message: string;
}

export type Geofence = {
  name: string;
  latitude: number;
  longitude: number;
  radius_metres: number;
  services?: string[];
};
