import type { Vehicle } from "./types";

const BODS_ZIP_URL = "https://data.bus-data.dft.gov.uk/avl/download/bulk_archive";
const zipPath = "/tmp/bods-national.zip";
const extractPath = "/tmp/bods-national";

function elapsed(start: number): string {
  return `${((performance.now() - start) / 1000).toFixed(2)}s`;
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
console.log(
  `Compressed size: ${(zipData.byteLength / 1024 / 1024).toFixed(2)} MB`
);
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
console.log(
  `SIRI-VM size: ${(siriFileSize / 1024 / 1024).toFixed(2)} MB`
);
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

const parsed = Bun.XML.parse(xml);

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

const vehicles: Vehicle = [];

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
// Write all.json
//

console.log("Writing live/all.json...");

const writeStart = performance.now();

const allJson = JSON.stringify(vehicles);

await Bun.write("live/all.json", allJson);

console.log(`Write complete: ${elapsed(writeStart)}`);
console.log(
  `all.json size: ${(Buffer.byteLength(allJson) / 1024 / 1024).toFixed(2)} MB`
);
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
