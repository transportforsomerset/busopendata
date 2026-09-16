export {};

const dataURL = "https://beta-naptan.dft.gov.uk/Download/National/csv";
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
