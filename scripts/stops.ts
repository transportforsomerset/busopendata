export {};

const dataURL = "https://beta-naptan.dft.gov.uk/Download/National/csv";

const outputFile = "data/naptan-national.csv";

console.log("Downloading NaPTAN national CSV...");
console.log(dataURL);

const response = await fetch(dataURL);

if (!response.ok) {
  throw new Error(`NaPTAN download failed: ${response.status} ${response.statusText}`);
}

const data = await response.arrayBuffer();
const bytes = new Uint8Array(data);

await Bun.write(outputFile, bytes);

console.log(`Downloaded ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
console.log(`Saved to ${outputFile}`);

// --------------------------------------------------
// Analyse the downloaded CSV
// --------------------------------------------------

console.log("\nReading downloaded CSV...");

const text = await Bun.file(outputFile).text();

const lines = text
  .split(/\r?\n/)
  .filter(line => line.length > 0);

const header = lines[0].split(",");
const rows = lines.slice(1);

console.log(`Records: ${rows.length.toLocaleString()}`);
console.log(`Columns: ${header.length}`);

const columnIndex = new Map(
  header.map((name, index) => [name, index])
);

const getColumn = (name: string): number => {
  const index = columnIndex.get(name);

  if (index === undefined) {
    throw new Error(`${name} column not found`);
  }

  return index;
};

const commonNameIndex = getColumn("CommonName");
const localityNameIndex = getColumn("LocalityName");
const indicatorIndex = getColumn("Indicator");
const bearingIndex = getColumn("Bearing");
const atcoCodeIndex = getColumn("ATCOCode");
const naptanCodeIndex = getColumn("NaptanCode");
const longitudeIndex = getColumn("Longitude");
const latitudeIndex = getColumn("Latitude");
const stopTypeIndex = getColumn("StopType");
const busStopTypeIndex = getColumn("BusStopType");

const targetLocality = "Taunton";

type Stop = {
  commonName: string;
  indicator: string;
  bearing: string;
  atcoCode: string;
  naptanCode: string;
  longitude: string;
  latitude: string;
  stopType: string;
  busStopType: string;
};

const tauntonStops: Stop[] = [];

for (const line of rows) {
  const fields = line.split(",");

  if (fields[localityNameIndex] !== targetLocality) {
    continue;
  }

  tauntonStops.push({
    commonName: fields[commonNameIndex],
    indicator: fields[indicatorIndex],
    bearing: fields[bearingIndex],
    atcoCode: fields[atcoCodeIndex],
    naptanCode: fields[naptanCodeIndex],
    longitude: fields[longitudeIndex],
    latitude: fields[latitudeIndex],
    stopType: fields[stopTypeIndex],
    busStopType: fields[busStopTypeIndex],
  });
}

console.log(
  `\n${targetLocality}: ${tauntonStops.length.toLocaleString()} records`
);

const commonNames = new Map<string, Stop[]>();

for (const stop of tauntonStops) {
  const existing = commonNames.get(stop.commonName);

  if (existing) {
    existing.push(stop);
  } else {
    commonNames.set(stop.commonName, [stop]);
  }
}

console.log(
  `Distinct CommonNames: ${commonNames.size.toLocaleString()}`
);

console.log("\nCommonNames in Taunton:");

for (const [name, stops] of [...commonNames.entries()]
  .sort((a, b) => b[1].length - a[1].length)
) {
  console.log(
    `  ${name.padEnd(40)} ${stops.length}`
  );
}

// Show the records behind the most repeated CommonNames.

const repeatedNames = [...commonNames.entries()]
  .filter(([, stops]) => stops.length > 1)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 20);

console.log("\nDetailed records for repeated CommonNames:");

for (const [name, stops] of repeatedNames) {
  console.log(`\n${name} (${stops.length} records)`);

  for (const stop of stops) {
    console.log(
      `  ${[
        `Indicator=${stop.indicator}`,
        `Bearing=${stop.bearing}`,
        `ATCO=${stop.atcoCode}`,
        `NaPTAN=${stop.naptanCode}`,
        `Lon=${stop.longitude}`,
        `Lat=${stop.latitude}`,
        `StopType=${stop.stopType}`,
        `BusStopType=${stop.busStopType}`,
      ].join(" | ")}`
    );
  }
}
