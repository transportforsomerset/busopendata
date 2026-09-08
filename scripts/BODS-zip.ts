import type { Vehicle } from "./types";

type BodsParsed = {
  Siri: {
    ServiceDelivery: {
      VehicleMonitoringDelivery: {
        VehicleActivity: Array<{
          RecordedAtTime?: string;
          MonitoredVehicleJourney?: {
            LineRef?: string;
            DirectionRef?: string;
            OperatorRef?: string;
            OriginName?: string;
            DestinationName?: string;
            VehicleRef?: string;
            Bearing?: string;
            VehicleLocation?: {
              Latitude?: string;
              Longitude?: string;
            };
            FramedVehicleJourneyRef?: {
              DatedVehicleJourneyRef?: string;
            };
          };
        }>;
      };
    };
  };
};

type CompactVehicle = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
  number,
  number,
  string | null,
  string,
  string
];

type CompactVehicleData = {
  version: 1;
  fields: string[];
  vehicles: CompactVehicle[];
};

const BODS_ZIP_URL = "https://data.bus-data.dft.gov.uk/avl/download/bulk_archive";
const zipPath = "/tmp/bods-national.zip";
const extractPath = "/tmp/bods-national";

const compactFields = [
  "vehicle_id",
  "operator",
  "operator_code",
  "route",
  "direction",
  "origin",
  "destination",
  "latitude",
  "longitude",
  "bearing",
  "occupancy",
  "recorded_at",
  "journey_id",
];

function elapsed(start: number): string {
  return `${((performance.now() - start) / 1000).toFixed(2)}s`;
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

console.log("BODS national ZIP + Bun XML benchmark");
console.log("──────────────────────────────────────");
console.log(`URL: ${BODS_ZIP_URL}`);
console.log();

//
// Download
//

console.log("Downloading national snapshot...");

const downloadStart = performance.now();

const response = await fetch(BODS_ZIP_URL);

if (!response.ok) {
  throw new Error(
    `BODS download failed: HTTP ${response.status}: ${response.statusText}`
  );
}

const zipData = await response.arrayBuffer();

await Bun.write(zipPath, zipData);

console.log(`Download complete: ${elapsed(downloadStart)}`);
console.log(`Compressed size: ${formatSize(zipData.byteLength)}`);
console.log();

//
// Extract
//

console.log("Extracting ZIP...");

const extractionStart = performance.now();

const unzip = Bun.spawn(
  ["unzip", "-o", zipPath, "-d", extractPath],
  {
    stdout: "pipe",
    stderr: "pipe",
  }
);

const unzipExitCode = await unzip.exited;

if (unzipExitCode !== 0) {
  const stderr = await new Response(unzip.stderr).text();

  throw new Error(
    `ZIP extraction failed (exit code ${unzipExitCode}):\n${stderr}`
  );
}

console.log(`Extraction complete: ${elapsed(extractionStart)}`);
console.log();

//
// Find XML
//

const find = Bun.spawn(
  ["find", extractPath, "-type", "f", "-printf", "%p\n"],
  {
    stdout: "pipe",
    stderr: "pipe",
  }
);

const files = (await new Response(find.stdout).text())
  .trim()
  .split("\n")
  .filter(Boolean);

const siriFile = files.find((file) =>
  file.toLowerCase().endsWith(".xml")
);

if (!siriFile) {
  throw new Error("No XML file found in extracted ZIP.");
}

const siriFileSize = await Bun.file(siriFile).size;

console.log(`SIRI-VM file: ${siriFile}`);
console.log(`SIRI-VM size: ${formatSize(siriFileSize)}`);
console.log();

//
// Read XML
//

console.log("Reading XML...");

const readStart = performance.now();

const xml = await Bun.file(siriFile).text();

console.log(`XML read: ${elapsed(readStart)}`);
console.log(`XML characters: ${xml.length.toLocaleString()}`);
console.log();

//
// Bun XML parse
//

console.log("Parsing XML with Bun.XML.parse()...");

const parseStart = performance.now();

const parsed = Bun.XML.parse(xml) as BodsParsed;

console.log(`XML parse: ${elapsed(parseStart)}`);
console.log();

const vehicleActivities =
  parsed.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity;

console.log(`VehicleActivity records: ${vehicleActivities.length}`);
console.log();

//
// Map to Vehicle[]
//

console.log("Mapping VehicleActivity records to Vehicle[]...");

const mapStart = performance.now();

const vehicles: Vehicle[] = [];

for (const activity of vehicleActivities) {
  const journey = activity.MonitoredVehicleJourney;

  if (!journey) continue;

  const vehicleId = journey.VehicleRef;
  const operatorCode = journey.OperatorRef;
  const route = journey.LineRef;
  const recordedAt = activity.RecordedAtTime;

  const latitude = Number(journey.VehicleLocation?.Latitude);
  const longitude = Number(journey.VehicleLocation?.Longitude);

  if (
    !vehicleId ||
    !operatorCode ||
    !route ||
    !recordedAt ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    continue;
  }

  vehicles.push({
    vehicle_id: vehicleId,
    operator: operatorCode,
    operator_code: operatorCode,
    route,
    direction: journey.DirectionRef ?? "",
    origin: journey.OriginName ?? "",
    destination: journey.DestinationName ?? "",
    latitude,
    longitude,
    bearing: Number(journey.Bearing ?? 0),
    occupancy: "",
    recorded_at: recordedAt,
    journey_id:
      journey.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ?? "",
  });
}

console.log(`Mapping complete: ${elapsed(mapStart)}`);
console.log(`Usable vehicles: ${vehicles.length}`);
console.log();

//
// Write original all.json
//

console.log("Writing live/all.json...");

const writeStart = performance.now();

const allJson = JSON.stringify(vehicles);

await Bun.write("live/all.json", allJson);

const allJsonSize = Buffer.byteLength(allJson);

console.log(`Write complete: ${elapsed(writeStart)}`);
console.log(`all.json size: ${formatSize(allJsonSize)}`);
console.log();

//
// Create compact representation
//

console.log("Creating compact all-new.json...");

const compactStart = performance.now();

const compactVehicles: CompactVehicle[] = vehicles.map((vehicle) => [
  vehicle.vehicle_id,
  vehicle.operator,
  vehicle.operator_code,
  vehicle.route,
  vehicle.direction ?? "",
  vehicle.origin,
  vehicle.destination,
  vehicle.latitude,
  vehicle.longitude,
  vehicle.bearing ?? 0,
  vehicle.occupancy,
  vehicle.recorded_at,
  vehicle.journey_id,
]);

const compactData: CompactVehicleData = {
  version: 1,
  fields: compactFields,
  vehicles: compactVehicles,
};

const allNewJson = JSON.stringify(compactData);

await Bun.write("live/all-new.json", allNewJson);

const allNewJsonSize = Buffer.byteLength(allNewJson);

console.log(`Compact creation complete: ${elapsed(compactStart)}`);
console.log(`all-new.json size: ${formatSize(allNewJsonSize)}`);
console.log();

//
// Decode compact representation
//

console.log("Decoding all-new.json for comparison...");

const decoded = JSON.parse(allNewJson) as CompactVehicleData;

const decodedVehicles: Vehicle[] = decoded.vehicles.map((vehicle) => ({
  vehicle_id: vehicle[0],
  operator: vehicle[1],
  operator_code: vehicle[2],
  route: vehicle[3],
  direction: vehicle[4],
  origin: vehicle[5],
  destination: vehicle[6],
  latitude: vehicle[7],
  longitude: vehicle[8],
  bearing: vehicle[9],
  occupancy: vehicle[10],
  recorded_at: vehicle[11],
  journey_id: vehicle[12],
}));

//
// Compare datasets
//

console.log("Comparing original and compact datasets...");

let differences = 0;

if (vehicles.length !== decodedVehicles.length) {
  console.log(
    `❌ Vehicle count differs: ${vehicles.length} vs ${decodedVehicles.length}`
  );
  differences++;
} else {
  console.log(`✓ Vehicle count identical: ${vehicles.length}`);
}

for (let i = 0; i < vehicles.length; i++) {
  const original = vehicles[i];
  const decodedVehicle = decodedVehicles[i];

  if (JSON.stringify(original) !== JSON.stringify(decodedVehicle)) {
    if (differences < 5) {
      console.log(`❌ Difference found at vehicle index ${i}`);
      console.log("Original:", original);
      console.log("Decoded: ", decodedVehicle);
    }

    differences++;
  }
}

if (differences === 0) {
  console.log("✓ All vehicles are identical after encode/decode");
} else {
  console.log(`❌ Total differences: ${differences}`);
}

console.log();

//
// Size comparison
//

const reductionBytes = allJsonSize - allNewJsonSize;
const reductionPercent =
  allJsonSize > 0
    ? (reductionBytes / allJsonSize) * 100
    : 0;

console.log("──────────────────────────────────────");
console.log("Format comparison");
console.log("──────────────────────────────────────");
console.log(`all.json:     ${formatSize(allJsonSize)}`);
console.log(`all-new.json: ${formatSize(allNewJsonSize)}`);
console.log(`Difference:   ${formatSize(reductionBytes)}`);
console.log(`Reduction:    ${reductionPercent.toFixed(1)}%`);
console.log();

if (differences === 0) {
  console.log("✓ COMPARISON PASSED");
  console.log("  Both formats contain identical vehicle data.");
} else {
  console.log("❌ COMPARISON FAILED");
  console.log("  The two formats do not contain identical data.");
}

console.log();

//
// Benchmark
//

console.log("──────────────────────────────────────");
console.log("Benchmark complete");
console.log(`Download: ${elapsed(downloadStart)}`);
console.log(`Parse:    ${elapsed(parseStart)}`);
console.log(`Total:    ${elapsed(downloadStart)}`);
console.log("──────────────────────────────────────");
