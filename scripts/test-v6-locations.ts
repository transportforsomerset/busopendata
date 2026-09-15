import type { Vehicle } from "./types";
import { createDictionary } from "./create-dictionary";

type CompactVehicleV4 = [
  string, string, number, string, number, number, number, number,
  string | null, number, string, string
];

type CompactVehicleDataV4 = {
  version: 4;
  dates: string[];
  directions: string[];
  destinations: string[];
  fields: string[];
  operator_names: Record<string, string>;
  operators: Record<string, CompactVehicleV4[]>;
};

type CompactVehicleV6 = [
  string, string, number, number, number, number, number, number,
  number, number, string, string
];

type CompactVehicleDataV6 = {
  version: 6;
  dates: string[];
  directions: string[];
  locations: string[];
  occupancies: string[];
  fields: string[];
  operator_names: Record<string, string>;
  operators: Record<string, CompactVehicleV6[]>;
};

const inputPath = "live/all-v4.json";
const outputPath = "live/all-v6-locations.json";

// BEGIN EXPORT SETUP.
export async function createV6(
  input: CompactVehicleDataV4,
  vehicles: Vehicle[],
  dates: string[],
  directions: string[],
  destinations: string[],
  operatorNames: Record<string, string>,
) {
// END EXPORT SETUP, code below is the standard code for this file.

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

console.log("\n\nv6 locations (for origins and destinations) dictionary test");
console.log("─────────────────────────");

const inputJson = await Bun.file(inputPath).text();
const inputSize = Buffer.byteLength(inputJson);
const inputV4 = JSON.parse(inputJson) as CompactVehicleDataV4;

if (inputV4.version !== 4) {
  throw new Error(`Expected v4 input (via const = inputV4), found version ${inputV4.version}`);
}

const vehiclesV6: Vehicle[] = [];

for (const [operatorCode, operatorVehicles] of Object.entries(inputV4.operators)) {
  const operatorName = inputV4.operator_names[operatorCode] ?? operatorCode;

  for (const vehicle of operatorVehicles) {
    const date = inputV4.dates[vehicle[9]];
    const direction = inputV4.directions[vehicle[2]];
    const destination = inputV4.destinations[vehicle[4]];

    if (date === undefined || direction === undefined || destination === undefined) {
      throw new Error(`Invalid dictionary index for vehicle ${vehicle[0]}`);
    }

    vehiclesV6.push({
      vehicle_id: vehicle[0],
      operator: operatorName,
      operator_code: operatorCode,
      route: vehicle[1],
      direction,
      origin: vehicle[3],
      destination,
      latitude: vehicle[5],
      longitude: vehicle[6],
      bearing: vehicle[7],
      occupancy: vehicle[8],
      recorded_at: `${date}T${vehicle[10]}+00:00`,
      journey_id: vehicle[11],
    });
  }
}

const { values: locations, indexByValue: locationIndexByValue } = createDictionary([...vehiclesV6.map((vehicle) => vehicle.origin),...vehiclesV6.map((vehicle) => vehicle.destination),]);
const { values: occupancies, indexByValue: occupancyIndexByValue,} = createDictionary(["", "seatsAvailable", "standingAvailable", "full"], "");
const unknownOccupancyValues = new Set<string>();
const operators: Record<string, CompactVehicleV6[]> = {};

for (const vehicle of vehiclesV6) {
  const operatorCode = vehicle.operator_code;
  operators[operatorCode] ??= [];

  const originIndex    =    locationIndexByValue.get(vehicle.origin);
//  const occupancyIndex = occupancyIndexByValue.get(vehicle.occupancy ?? "");

let occupancy = vehicle.occupancy ?? "";
//const occupancy = vehicle.occupancy ?? "";

if (
  occupancy !== "" &&
  occupancy !== "seatsAvailable" &&
  occupancy !== "standingAvailable" &&
  occupancy !== "full"
) {
  unknownOccupancyValues.add(occupancy);
  occupancy = "";
  //throw new Error(`Unknown occupancy "${vehicle.occupancy}" for vehicle ${vehicle.vehicle_id}`);
}

//const occupancyIndex = occupancyIndexByValue.get(occupancy);
  const occupancyIndex = occupancyIndexByValue.get(occupancy as "" | "seatsAvailable" | "standingAvailable" | "full");
  
  if (originIndex === undefined)    { throw new Error(`Unknown origin "${vehicle.origin}" for vehicle ${vehicle.vehicle_id}`); }
  if (occupancyIndex === undefined) { throw new Error(`Unknown occupancy "${vehicle.occupancy}" for vehicle ${vehicle.vehicle_id}` ); }

  const directionIndex = inputV4.directions.indexOf(vehicle.direction ?? "");
  if (directionIndex === -1) {
    throw new Error(
      `Unknown direction "${vehicle.direction}" for vehicle ${vehicle.vehicle_id}`
    );
  }

//  const destinationIndex = inputV4.destinations.indexOf(vehicle.destination);
  const destinationIndex = locationIndexByValue.get(vehicle.destination);
  if (destinationIndex === undefined) {
    throw new Error(
      `Unknown destination "${vehicle.destination}" for vehicle ${vehicle.vehicle_id}`
    );
  }

  const recordedDate = vehicle.recorded_at.slice(0, 10);
  const dateIndex = inputV4.dates.indexOf(recordedDate);
  if (dateIndex === -1) {
    throw new Error(
      `Unknown recorded date "${recordedDate}" for vehicle ${vehicle.vehicle_id}`
    );
  }

  operators[operatorCode].push([
    vehicle.vehicle_id,
    vehicle.route,
    directionIndex,
    originIndex,
    destinationIndex,
    vehicle.latitude,
    vehicle.longitude,
    vehicle.bearing ?? 0,
    occupancyIndex,
    dateIndex,
    vehicle.recorded_at.slice(11, 19),
    vehicle.journey_id,
  ]);
}

const compactDataV6: CompactVehicleDataV6 = {
  version: 6,
  dates: inputV4.dates,
  directions: inputV4.directions,
  locations,
  occupancies,
  fields: [
    "vehicle_id", "route", "direction", "origin", "destination",
    "latitude", "longitude", "bearing", "occupancy",
    "recorded_date", "recorded_time", "journey_id",
  ],
  operator_names: inputV4.operator_names,
  operators,
};

const outputJson = JSON.stringify(compactDataV6);
const outputSize = Buffer.byteLength(outputJson);
await Bun.write(outputPath, outputJson);

console.log(`Vehicles:         ${vehiclesV6.length}`);
console.log(`Location entries: ${locations.length}`);
console.log(`all-v4.json:      ${formatSize(inputSize)}`);
console.log(`v6 locations:      ${formatSize(outputSize)}`);
console.log();

const decodedVehicles: Vehicle[] = [];

for (const [operatorCode, operatorVehicles] of Object.entries(compactDataV6.operators)) {
  const operatorName = compactDataV6.operator_names[operatorCode] ?? operatorCode;

  for (const vehicle of operatorVehicles) {
    const date = compactDataV6.dates[vehicle[9]];
    const direction = compactDataV6.directions[vehicle[2]];
    const origin = compactDataV6.locations[vehicle[3]];
    const destination = compactDataV6.locations[vehicle[4]];
    const occupancy = compactDataV6.occupancies[vehicle[8]];

    if (
      date === undefined ||
      direction === undefined ||
      origin === undefined ||
      destination === undefined ||
      occupancy === undefined
    ) {
      throw new Error(`Invalid v6 dictionary index for vehicle ${vehicle[0]}`);
    }

    decodedVehicles.push({
      vehicle_id: vehicle[0],
      operator: operatorName,
      operator_code: operatorCode,
      route: vehicle[1],
      direction,
      origin,
      destination,
      latitude: vehicle[5],
      longitude: vehicle[6],
      bearing: vehicle[7],
      occupancy,
      recorded_at: `${date}T${vehicle[10]}+00:00`,
      journey_id: vehicle[11],
    });
  }
}

const sourceById = new Map(vehiclesV6.map((vehicle) => [vehicle.vehicle_id, vehicle]));
const decodedById = new Map(decodedVehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));

let differences = 0;

if (sourceById.size !== decodedById.size) {
  console.log(`❌ Unique vehicle IDs differ: ${sourceById.size} vs ${decodedById.size}`);
  differences++;
}

for (const [vehicleId, original] of sourceById) {
  const decoded = decodedById.get(vehicleId);

  if (!decoded || JSON.stringify(original) !== JSON.stringify(decoded)) {
    if (differences < 5) {
      console.log(`❌ Difference found for vehicle ${vehicleId}`);
    }
    differences++;
  }
}

if (differences === 0) {
  console.log("✓ All vehicles are identical after v6 location encode/decode");
} else {
  console.log(`❌ Total v6 differences: ${differences}`);
}

const savingsBytes = inputSize - outputSize;
const savingsPercent = inputSize > 0 ? (savingsBytes / inputSize) * 100 : 0;

console.log(`Savings:        ${formatSize(savingsBytes)} (${savingsPercent.toFixed(1)}%)`);


// Any new values for "occupancy"?
if (unknownOccupancyValues.size > 0) {
  console.log(`⚠️ Unknown occupancy values detected: ${[...unknownOccupancyValues,].join(", ")}`);
  console.log("These values were encoded as empty occupancy.");
}

// BEGIN EXPORT FINISH.
      return {
        compactDataV6,
        json: JSON.stringify(compactDataV6),
        differences,
    };
}
// END EXPORT FINISH.
