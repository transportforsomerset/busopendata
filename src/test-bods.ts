const apiKey = process.env.BODS_API_KEY;

if (!apiKey) {
  console.error("BUS_DATA_API secret is not available.");
  process.exit(1);
}

// Small test area around Taunton.
// Format: minLongitude,minLatitude,maxLongitude,maxLatitude
const boundingBox = "-3.15,50.98,-3.05,51.05";

const url = new URL("https://data.bus-data.dft.gov.uk/api/v1/datafeed");
url.searchParams.set("boundingBox", boundingBox);
url.searchParams.set("api_key", apiKey);

console.log("Requesting BODS data...");
console.log(`Bounding box: ${boundingBox}`);

const response = await fetch(url);

console.log(`HTTP status: ${response.status} ${response.statusText}`);
console.log(
  `Content-Type: ${response.headers.get("content-type") ?? "unknown"}`
);

const body = await response.text();

console.log(`Response size: ${body.length} characters`);

if (!response.ok) {
  console.error("BODS request failed.");
  console.error(`HTTP ${response.status}: ${response.statusText}`);

  // Show a small amount of the response because BODS may
  // provide a useful error message.
  console.error(body.slice(0, 500));

  process.exit(1);
}

if (!body.trim()) {
  console.error("BODS returned an empty response.");
  process.exit(1);
}

console.log("BODS request succeeded.");
console.log("First part of response:");
console.log(body.slice(0, 300));
