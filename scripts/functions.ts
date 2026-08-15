import type { BusData, VehicleHistory } from "./types";
import { calculateDistanceMetres } from "./movement";

export function analyseMovement(
  vehicles: BusData["vehicles"],
  previousHistory: Record<string, VehicleHistory>
): Record<string, VehicleHistory> {
  const newHistory: Record<string, VehicleHistory> = {};

  console.log("");
  console.log("Movement analysis:");

  for (const vehicle of vehicles) {
    const previous = previousHistory[vehicle.vehicle_id];

    if (!previous) {
      console.log(
        `${vehicle.route} ${vehicle.vehicle_id}: no previous position — recording baseline.`
      );
    } else {
      const distanceMetres = calculateDistanceMetres(
        previous.latitude,
        previous.longitude,
        vehicle.latitude,
        vehicle.longitude
      );

      const previousTime = Date.parse(previous.recorded_at);
      const currentTime = Date.parse(vehicle.recorded_at);
      const elapsedSeconds = (currentTime - previousTime) / 1000;

      if (elapsedSeconds > 0) {
        const speedMps = distanceMetres / elapsedSeconds;

        console.log(
          `${vehicle.route} ${vehicle.vehicle_id}: ` +
            `${distanceMetres.toFixed(1)}m in ${elapsedSeconds.toFixed(0)}s ` +
            `(${speedMps.toFixed(2)} m/s)`
        );
      } else {
        console.log(
          `${vehicle.route} ${vehicle.vehicle_id}: ` +
            `${distanceMetres.toFixed(1)}m — invalid time interval`
        );
      }
    }

    newHistory[vehicle.vehicle_id] = {
      vehicle_id: vehicle.vehicle_id,
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      recorded_at: vehicle.recorded_at,
    };
  }

  return newHistory;
}
