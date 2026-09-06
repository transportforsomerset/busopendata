import type { Vehicle } from "./types";

// Needed for debugging with our test action.
const debug = process.argv.includes("--debug");

const BODS_API_URL = "https://data.bus-data.dft.gov.uk/api/v1/datafeed";

const SECONDS_PER_MINUTE = 60;
const GHOST_VEHICLE_AGE_SECONDS = 20 * SECONDS_PER_MINUTE;

function getTagValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match?.[1] ?? null;
}

function cleanText(value: string): string {
  return value
    .replace(/\\_/g, " ")
    .replace(/_/g, " ")
    .trim();
}

export async function fetchBodsData(): Promise<Vehicle[]> {
  const apiKey = process.env.BODS_API_KEY;

  if (!apiKey) {
    throw new Error("BODS_API_KEY secret is not set.");
  }

  const boundingBox = "-5.81,49.92,1.85,56.20";

  const url = new URL(BODS_API_URL);
  url.searchParams.set("boundingBox", boundingBox);
  url.searchParams.set("api_key", apiKey);

  if (debug) {
    console.log("Requesting BODS live vehicle data...");
    console.log(`Bounding box: ${boundingBox}`);
  }

  const response = await fetch(url);

  if (debug) {
    console.log(
      `HTTP status: ${response.status} ${response.statusText}`
    );
    console.log(
      `Content-Type: ${response.headers.get("content-type") ?? "unknown"}`
    );
  }

  const xml = await response.text();

  if (debug) {
    console.log(`Response size: ${xml.length} characters`);
  }

  if (!response.ok) {
    if (debug) {
      console.error(xml.slice(0, 500));
    }

    throw new Error(
      `BODS request failed: HTTP ${response.status}: ${response.statusText}`
    );
  }

  if (!xml.trim()) {
    throw new Error("BODS returned an empty response.");
  }

  const vehicleActivities =
    xml.match(
      /<VehicleActivity>[\s\S]*?<\/VehicleActivity>/g
    ) ?? [];

  if (debug) {
    console.log(
      `VehicleActivity records found: ${vehicleActivities.length}`
    );
  }

  const vehicles: Vehicle[] = [];

  for (const activity of vehicleActivities) {
    const lineRef = getTagValue(activity, "LineRef");
    const publishedLineName = getTagValue(
      activity,
      "PublishedLineName"
    );

    const line = (
      lineRef ??
      publishedLineName ??
      ""
    ).toUpperCase();

    const operatorCode =
      getTagValue(activity, "OperatorRef")?.toUpperCase() ?? "";

    /*
     * TODO:
     * Apply the configured services.json allow-list here.
     *
     * For the first clean version, we'll establish the BODS
     * fetch and Vehicle mapping before bringing configuration
     * filtering back in.
     */

    if (!line || !operatorCode) {
      continue;
    }

    const recordedAt = getTagValue(
      activity,
      "RecordedAtTime"
    );

    if (!recordedAt) {
      continue;
    }

    const recordedTime = Date.parse(recordedAt);

    if (Number.isNaN(recordedTime)) {
      continue;
    }

    const ageSeconds = Math.floor(
      (Date.now() - recordedTime) / 1000
    );

    if (ageSeconds > GHOST_VEHICLE_AGE_SECONDS) {
      continue;
    }

    const vehicleId = getTagValue(activity, "VehicleRef");

    if (!vehicleId) {
      continue;
    }

    const locationMatch = activity.match(
      /<VehicleLocation>[\s\S]*?<Longitude>([^<]+)<\/Longitude>[\s\S]*?<Latitude>([^<]+)<\/Latitude>[\s\S]*?<\/VehicleLocation>/
    );

    if (!locationMatch) {
      continue;
    }

    const longitude = Number(locationMatch[1]);
    const latitude = Number(locationMatch[2]);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const journeyId =
      getTagValue(activity, "DatedVehicleJourneyRef") ?? "";

    const vehicle: Vehicle = {
      vehicle_id: vehicleId,
      operator: operatorCode,
      operator_code: operatorCode,
      route: line,
      direction:
        getTagValue(activity, "DirectionRef") ?? "",
      origin: cleanText(
        getTagValue(activity, "OriginName") ?? ""
      ),
      destination: cleanText(
        getTagValue(activity, "DestinationName") ?? ""
      ),
      latitude,
      longitude,
      bearing: Number(
        getTagValue(activity, "Bearing") ?? 0
      ),
      occupancy: "",
      recorded_at: recordedAt,
      journey_id: journeyId,
    };

    vehicles.push(vehicle);
  }

  if (debug) {
    console.log(`Matching vehicles: ${vehicles.length}`);
  }

  return vehicles;
}
