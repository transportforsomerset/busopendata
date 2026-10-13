import { fetchBodsData } from "./fetch-bods-api";

const requestCount = 6;
const intervalMs = 5_000;

let previousVehicles: Map<string, Awaited<ReturnType<typeof fetchBodsData>>[number]> | null = null;

console.log("BODS repeated-request experiment");
console.log(`Requests: ${requestCount}`);
console.log(`Interval: ${intervalMs / 1000} seconds`);

for (let requestNumber = 1; requestNumber <= requestCount; requestNumber++) {
  console.log(`\n--- Request ${requestNumber}/${requestCount} ---`);
  console.log(`Started: ${new Date().toISOString()}`);

  try {
    const vehicles = await fetchBodsData();

    const currentVehicles = new Map(
      vehicles.map(vehicle => [vehicle.vehicle_id, vehicle])
    );

    console.log(`Vehicles returned: ${vehicles.length}`);

    if (previousVehicles !== null) {
      let changedPositions = 0;
      let changedTimestamps = 0;
      let newVehicles = 0;
      let missingVehicles = 0;

      for (const [id, vehicle] of currentVehicles) {
        const previous = previousVehicles.get(id);

        if (!previous) {
          newVehicles++;
          continue;
        }

        if (
          vehicle.latitude !== previous.latitude ||
          vehicle.longitude !== previous.longitude
        ) {
          changedPositions++;
        }

        if (vehicle.recorded_at !== previous.recorded_at) {
          changedTimestamps++;
        }
      }

      for (const id of previousVehicles.keys()) {
        if (!currentVehicles.has(id)) {
          missingVehicles++;
        }
      }

      console.log(`Positions changed: ${changedPositions}`);
      console.log(`Timestamps changed: ${changedTimestamps}`);
      console.log(`New vehicles: ${newVehicles}`);
      console.log(`Vehicles no longer returned: ${missingVehicles}`);
    } else {
      console.log("Baseline snapshot recorded.");
    }

    previousVehicles = currentVehicles;
  } catch (error) {
    console.error(
      `Request ${requestNumber} failed:`,
      error instanceof Error ? error.message : error
    );
  }

  if (requestNumber < requestCount) {
    console.log("Waiting 5 seconds...");
    await Bun.sleep(intervalMs);
  }
}

console.log("\nExperiment complete.");
