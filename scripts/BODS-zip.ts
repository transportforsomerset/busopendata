const BODS_ZIP_URL =
  "https://data.bus-data.dft.gov.uk/avl/download/bulk_archive";

const zipPath = "/tmp/bods-national.zip";
const extractPath = "/tmp/bods-national";

function elapsed(start: number): string {
  return `${((performance.now() - start) / 1000).toFixed(2)}s`;
}

console.log("BODS national ZIP benchmark");
console.log("────────────────────────────");
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

const downloadTime = elapsed(downloadStart);

console.log(`Download complete: ${downloadTime}`);
console.log(
  `Compressed size: ${(zipData.byteLength / 1024 / 1024).toFixed(2)} MB`
);
console.log();

//
// Extraction
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

const extractionTime = elapsed(extractionStart);

console.log(`Extraction complete: ${extractionTime}`);
console.log();

//
// Inspect extracted files
//

console.log("Extracted files:");

const find = Bun.spawn(
  ["find", extractPath, "-type", "f", "-printf", "%p\\n"],
  {
    stdout: "pipe",
    stderr: "pipe",
  }
);

const files = (await new Response(find.stdout).text())
  .trim()
  .split("\n")
  .filter(Boolean);

for (const file of files) {
  const stat = await Bun.file(file).stat();

  console.log(
    `  ${file} — ${(stat.size / 1024 / 1024).toFixed(2)} MB`
  );
}

console.log();

//
// Locate SIRI XML
//

const siriFile = files.find((file) =>
  file.toLowerCase().endsWith(".xml")
);

if (!siriFile) {
  throw new Error("No XML file found in the extracted ZIP.");
}

console.log(`SIRI-VM file: ${siriFile}`);

const siriFileSize = await Bun.file(siriFile).size;

console.log(
  `SIRI-VM size: ${(siriFileSize / 1024 / 1024).toFixed(2)} MB`
);

console.log();

//
// Parse SIRI-VM
//

console.log("Reading SIRI-VM XML...");

const parseStart = performance.now();

const xml = await Bun.file(siriFile).text();

console.log(`XML read: ${elapsed(parseStart)}`);
console.log(`XML characters: ${xml.length.toLocaleString()}`);

const vehicleActivities =
  xml.match(
    /<VehicleActivity>[\s\S]*?<\/VehicleActivity>/g
  ) ?? [];

const parseTime = elapsed(parseStart);

console.log(
  `VehicleActivity records: ${vehicleActivities.length.toLocaleString()}`
);
console.log(`VehicleActivity scan: ${parseTime}`);

console.log();

//
// Basic vehicle validation
//

console.log("Checking vehicle records...");

const validationStart = performance.now();

let usableVehicles = 0;

for (const activity of vehicleActivities) {
  const vehicleRef =
    activity.match(/<VehicleRef>([^<]*)<\/VehicleRef>/)?.[1];

  const operatorRef =
    activity.match(/<OperatorRef>([^<]*)<\/OperatorRef>/)?.[1];

  const lineRef =
    activity.match(/<LineRef>([^<]*)<\/LineRef>/)?.[1];

  const recordedAt =
    activity.match(/<RecordedAtTime>([^<]*)<\/RecordedAtTime>/)?.[1];

  if (
    vehicleRef &&
    operatorRef &&
    lineRef &&
    recordedAt
  ) {
    usableVehicles++;
  }
}

console.log(
  `Usable vehicle records: ${usableVehicles.toLocaleString()}`
);
console.log(`Validation time: ${elapsed(validationStart)}`);

console.log();

//
// Total
//

console.log("────────────────────────────");
console.log("Benchmark complete");
console.log(`Download:   ${downloadTime}`);
console.log(`Extraction: ${extractionTime}`);
console.log(`Parsing:    ${parseTime}`);
console.log(
  `Total:      ${elapsed(downloadStart)}`
);
console.log("────────────────────────────");
