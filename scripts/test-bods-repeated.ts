import { fetchBodsData } from "./fetch-bods-api";

const requestCount = 50;   // Check data 50 times.
const intervalMs = 10_000; // Check every 10 seconds. 

let previousVehicles: Map<string, Awaited<ReturnType<typeof fetchBodsData>>[number]> | null = null;

console.log("BODS repeated-request experiment");
console.log(`Requests: ${requestCount}`);
console.log(`Target interval: ${intervalMs / 1000} seconds (start-to-start)`);

for (let requestNumber = 1; requestNumber <= requestCount; requestNumber++) {
  // Measure the whole task so the next request starts at the target interval.
  const taskStartedAt = performance.now();

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
    const taskDurationMs = performance.now() - taskStartedAt;
    const remainingMs = intervalMs - taskDurationMs;

    console.log(`Task completed in ${(taskDurationMs / 1000).toFixed(2)} seconds.`);

    if (remainingMs > 0) {
      console.log(`Waiting ${(remainingMs / 1000).toFixed(2)} seconds...`);
      await Bun.sleep(remainingMs);
    } else {
      console.log("Task took longer than the target interval; starting next request immediately.");
    }
  }
}

console.log("\nExperiment complete.");
