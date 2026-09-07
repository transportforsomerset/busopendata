/* Previous idea, use a Raspberry Pi to run the site. Now using GitHub Actions for everything. */
export type DataSource = "live" | "github" | "pi" | "sample";
export type DataStatus = "live" | "backup" | "stale" | "sample";

export interface Vehicle {
  vehicle_id: string;
  operator: string;
  operator_code: string;
  route: string;
  direction?: string;
  origin: string;
  destination: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  occupancy: string | null;
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

export interface ServiceGroup {
  ref: string;
  name?: string;
  services: string[];
  route_id?: string;
}

export interface Geofence {
  name: string;
  latitude: number;
  longitude: number;
  operator: string;
  radius_metres: number;
  services?: string[];
}

/**
 * A journey returned by the MegaBus GetJourney endpoint.
 *
 * JrnyID is the stable journey identifier. JourneyID may be "0"
 * even when GetJourneyStage subsequently returns live tracking data.
 */
export interface MegaBusJourney {
  jrny_id: string;
  journey_id: string;
  route: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  duration: string;
  is_live: string;
  vehicle: string;
}

/**
 * The MegaBus journey catalogue saved in data/megabus.json.
 */
export interface MegaBusConfig {
  operator: string;
  route: string;
  services: MegaBusJourney[];
}

/**
 * A live vehicle produced by the MegaBus collector.
 */
export interface MegaBusVehicle {
  vehicle_id: string;
  operator_code: string;
  operator: string;
  route: string;
  origin: string;
  destination: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  bearing: number | null;
  occupancy: string | null;
  journey_id: string;
}

/**
 * Top-level response from the MegaBus GetJourneyStage endpoint.
 */
export interface MegaBusResponse {
  OpStatus?: string;
  Message?: string;
  entity?: string;
}

/**
 * Parsed entity returned inside the MegaBus GetJourneyStage response.
 */
export interface MegaBusEntity {
  Table?: Array<Record<string, unknown>>;
  Table1?: Array<Record<string, unknown>>;
  Table2?: Array<Record<string, unknown>>;
  Table3?: Array<Record<string, unknown>>;
}
