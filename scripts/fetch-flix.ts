import type { Vehicle } from "./types";

// Needed for debugging with our test action.
const debug = process.argv.includes("--debug");

export async function fetchFlixData(): Promise<Vehicle[]> {
  if (debug) {
    console.log("Flix isn't LIVE yet!");
  }

  return [];
}

if (import.meta.main) {
  const vehicles = await fetchFlixData();

  if (debug) {
    console.log(`Returned ${vehicles.length} vehicles.`);
  }
}
