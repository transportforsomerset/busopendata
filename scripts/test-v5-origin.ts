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

type CompactVehicleV5 = [
  string, string, number, number, number, number, number, number,
  string | null, number, string, string
];

type CompactVehicleDataV5 = {
  version: 5;
  dates: string[];
  directions: string[];
  origins: string[];
  occupancies: string[];
  destinations: string[];
  fields: string[];
  operator_names: Record<string, string>;
  operators: Record<string, CompactVehicleV5[]>;
};

const inputPath = "live/all-v4.json";
const outputPath = "live/all-v5-origin.json";

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

console.log("v5 origin dictionary test");
console.log("─────────────────────────");

const inputJson = await Bun.file(inputPath).text();
const inputSize = Buffer.byteLength(inputJson);
const input = JSON.parse(inputJson) as CompactVehicleDataV4;

if (input.version !== 4) {
  throw new Error(`Expected v4 input, found version ${input.version}`);
}

const vehicles: Vehicle[] = [];

for (const [operatorCode, operatorVehicles] of Object.entries(input.operators)) {
  const operatorName = input.operator_names[operatorCode] ?? operatorCode;

  for (const vehicle of operatorVehicles) {
    const date = input.dates[vehicle[9]];
    const direction = input.directions[vehicle[2]];
    const destination = input.destinations[vehicle[4]];

    if (date === undefined || direction === undefined || destination === undefined) {
      throw new Error(`Invalid dictionary index for vehicle ${vehicle[0]}`);
    }

    vehicles.push({
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

const { values: origins,     indexByValue: originIndexByValue,   } = createDictionary(vehicles.map((vehicle) => vehicle.origin));
const { values: occupancies, indexByValue: occupancyIndexByValue,} = createDictionary(["", "seatsAvailable", "standingAvailable", "full"], "");

const operators: Record<string, CompactVehicleV5[]> = {};

for (const vehicle of vehicles) {
  const operatorCode = vehicle.operator_code;
  operators[operatorCode] ??= [];

  const originIndex    =    originIndexByValue.get(vehicle.origin);
  const occupancyIndex = occupancyIndexByValue.get(vehicle.occupancy);

  if (originIndex === undefined)    { throw new Error(`Unknown origin "${vehicle.origin}" for vehicle ${vehicle.vehicle_id}`); }
  if (occupancyIndex === undefined) { throw new Error(`Unknown occupancy "${vehicle.occupancy}" for vehicle ${vehicle.vehicle_id}` ); }

  const directionIndex = input.directions.indexOf(vehicle.direction ?? "");
  if (directionIndex === -1) {
    throw new Error(
      `Unknown direction "${vehicle.direction}" for vehicle ${vehicle.vehicle_id}`
    );
  }

  const destinationIndex = input.destinations.indexOf(vehicle.destination);
  if (destinationIndex === -1) {
    throw new Error(
      `Unknown destination "${vehicle.destination}" for vehicle ${vehicle.vehicle_id}`
    );
  }

  const recordedDate = vehicle.recorded_at.slice(0, 10);
  const dateIndex = input.dates.indexOf(recordedDate);
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

const compactDataV5: CompactVehicleDataV5 = {
  version: 5,
  dates: input.dates,
  directions: input.directions,
  origins,
  occupancies,
  destinations: input.destinations,
  fields: [
    "vehicle_id", "route", "direction", "origin", "destination",
    "latitude", "longitude", "bearing", "occupancy",
    "recorded_date", "recorded_time", "journey_id",
  ],
  operator_names: input.operator_names,
  operators,
};

const outputJson = JSON.stringify(compactDataV5);
const outputSize = Buffer.byteLength(outputJson);
await Bun.write(outputPath, outputJson);

console.log(`Vehicles:       ${vehicles.length}`);
console.log(`Origin entries: ${origins.length}`);
console.log(`all-v4.json:    ${formatSize(inputSize)}`);
console.log(`v5 origin:      ${formatSize(outputSize)}`);
console.log();

const decodedVehicles: Vehicle[] = [];

for (const [operatorCode, operatorVehicles] of Object.entries(compactDataV5.operators)) {
  const operatorName = compactDataV5.operator_names[operatorCode] ?? operatorCode;

  for (const vehicle of operatorVehicles) {
    const date = compactDataV5.dates[vehicle[9]];
    const direction = compactDataV5.directions[vehicle[2]];
    const origin = compactDataV5.origins[vehicle[3]];
    const destination = compactDataV5.destinations[vehicle[4]];
    const occupancy = compactDataV5.occupancies[vehicle[8]];

    if (
      date === undefined ||
      direction === undefined ||
      origin === undefined ||
      destination === undefined ||
      occupancy === undefined
    ) {
      throw new Error(`Invalid v5 dictionary index for vehicle ${vehicle[0]}`);
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

const sourceById = new Map(vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));
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
  console.log("✓ All vehicles are identical after v5 origin encode/decode");
} else {
  console.log(`❌ Total v5 differences: ${differences}`);
}

const savingsBytes = inputSize - outputSize;
const savingsPercent = inputSize > 0 ? (savingsBytes / inputSize) * 100 : 0;

console.log(`Savings:        ${formatSize(savingsBytes)} (${savingsPercent.toFixed(1)}%)`);
