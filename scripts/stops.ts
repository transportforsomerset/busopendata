export {};

const dataURL =
  "https://beta-naptan.dft.gov.uk/Download/National/csv";

const outputFile = "data/naptan-national.csv";

console.log("Downloading NaPTAN national CSV...");
console.log(dataURL);

const response = await fetch(dataURL);

if (!response.ok) {
  throw new Error(
    `NaPTAN download failed: ${response.status} ${response.statusText}`
  );
}

const data = await response.arrayBuffer();
const bytes = new Uint8Array(data);

await Bun.write(outputFile, bytes);

console.log(
  `Downloaded ${(bytes.length / 1024 / 1024).toFixed(1)} MB`
);

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

const commonNameIndex = columnIndex.get("CommonName");
const localityNameIndex = columnIndex.get("LocalityName");

if (commonNameIndex === undefined) {
  throw new Error("CommonName column not found");
}

if (localityNameIndex === undefined) {
  throw new Error("LocalityName column not found");
}

const commonNames = new Map<string, number>();
const localities = new Map<string, number>();

for (const line of rows) {
  const fields = line.split(",");

  const commonName = fields[commonNameIndex];
  const localityName = fields[localityNameIndex];

  if (commonName) {
    commonNames.set(
      commonName,
      (commonNames.get(commonName) ?? 0) + 1
    );
  }

  if (localityName) {
    localities.set(
      localityName,
      (localities.get(localityName) ?? 0) + 1
    );
  }
}

console.log(
  `Distinct CommonNames: ${commonNames.size.toLocaleString()}`
);

console.log(
  `Distinct LocalityNames: ${localities.size.toLocaleString()}`
);

console.log("\nTop LocalityNames:");

for (const [name, count] of [...localities.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50)) {
  console.log(
    `  ${name.padEnd(35)} ${count.toLocaleString()}`
  );
}

console.log("\nTop CommonNames:");

for (const [name, count] of [...commonNames.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50)) {
  console.log(
    `  ${name.padEnd(35)} ${count.toLocaleString()}`
  );
}
