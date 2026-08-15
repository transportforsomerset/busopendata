import type { BusData, Vehicle } from "./types";

export function validateBusData(data: unknown): data is BusData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const value = data as Record<string, unknown>;

  if (value.schema_version !== 1) return false;
  if (typeof value.generated_at !== "string") return false;
  if (Number.isNaN(Date.parse(value.generated_at))) return false;

  if (
    value.source !== "live" &&
    value.source !== "github" &&
    value.source !== "pi" &&
    value.source !== "sample"
  ) {
    return false;
  }

  if (
    value.status !== "live" &&
    value.status !== "backup" &&
    value.status !== "stale" &&
    value.status !== "sample"
  ) {
    return false;
  }

  if (!Array.isArray(value.vehicles)) {
    return false;
  }

  if (value.vehicle_count !== value.vehicles.length) {
    return false;
  }

  return value.vehicles.every(isVehicle);
}

function isVehicle(value: unknown): value is Vehicle {
  if (!value || typeof value !== "object") {
    return false;
  }

  const vehicle = value as Record<string, unknown>;

  if (typeof vehicle.vehicle_id !== "string") return false;
  if (typeof vehicle.operator !== "string") return false;
  if (typeof vehicle.operator_code !== "string") return false;
  if (typeof vehicle.route !== "string") return false;
  if (typeof vehicle.direction !== "string") return false;
  if (typeof vehicle.origin !== "string") return false;
  if (typeof vehicle.destination !== "string") return false;
  if (typeof vehicle.latitude !== "number") return false;
  if (typeof vehicle.longitude !== "number") return false;
  if (typeof vehicle.bearing !== "number") return false;
  if (typeof vehicle.speed_mps !== "number") return false;
  if (typeof vehicle.occupancy !== "string") return false;
  if (typeof vehicle.recorded_at !== "string") return false;
  if (typeof vehicle.journey_id !== "string") return false;

  if (vehicle.latitude < -90 || vehicle.latitude > 90) {
    return false;
  }

  if (vehicle.longitude < -180 || vehicle.longitude > 180) {
    return false;
  }

  if (vehicle.bearing < 0 || vehicle.bearing > 360) {
    return false;
  }

  if (vehicle.speed_mps < 0) {
    return false;
  }

  if (Number.isNaN(Date.parse(vehicle.recorded_at))) {
    return false;
  }

  return true;
}
