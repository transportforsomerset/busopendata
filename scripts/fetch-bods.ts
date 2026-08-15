import type { BusData, Geofence, Vehicle } from "./types";
import { calculateDistanceMetres } from "./movement";

/* URL for the live data source, the DFT. */
const BODS_API_URL = "https://data.bus-data.dft.gov.uk/api/v1/datafeed";

/* data stores for tracking timeouts for buses that might have ended service but not turned off their tracking */
const SECONDS_PER_MINUTE = 60;
const LIVE_VEHICLE_AGE_SECONDS = 10 * SECONDS_PER_MINUTE;
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

/* BEGIN: GeoFence Depot */
function isInsideGeofence(
  latitude: number,
  longitude: number,
  route: string,
  geofences: Geofence[]
): boolean {
  for (const geofence of geofences) {
    if (geofence.services && !geofence.services.includes(route)) {
      continue;
    }

    const distance = calculateDistanceMetres(
      latitude,
      longitude,
      geofence.latitude,
      geofence.longitude
    );

    if (distance <= geofence.radius_metres) {
      console.log(`Ignoring ${route} vehicle inside ${geofence.name} geofence (${Math.round(distance)}m)`);
      return true;
    }
  }

  return false;
}
/* END: GeoFence Depot */

export async function fetchBodsData(trackedServices: Set<string>,geofences: Geofence[]): Promise<BusData> {
  const apiKey = process.env.BODS_API_KEY;

  if (!apiKey) {
    throw new Error("BODS_API_KEY secret is not set.");
  }

  const boundingBox = "-3.55,51.27,-2.35,50.48";

  const url = new URL(BODS_API_URL);

  url.searchParams.set("boundingBox", boundingBox);
  url.searchParams.set("api_key", apiKey);

  console.log("Requesting BODS live vehicle data...");
  console.log(`Bounding box: ${boundingBox}`);

  const response = await fetch(url);

  console.log(`HTTP status: ${response.status} ${response.statusText}`);
  console.log(`Content-Type: ${response.headers.get("content-type") ?? "unknown"}`);

  const xml = await response.text();

  console.log(`Response size: ${xml.length} characters`);

  if (!response.ok) {
    console.error(xml.slice(0, 500));

    throw new Error(`BODS request failed: HTTP ${response.status}: ${response.statusText}`);
  }

  if (!xml.trim()) {
    throw new Error("BODS returned an empty response.");
  }

  console.log("BODS request succeeded.");

  const vehicleActivities = xml.match(/<VehicleActivity>[\s\S]*?<\/VehicleActivity>/g) ?? [];

  console.log(`VehicleActivity records found: ${vehicleActivities.length}`);

  const vehicles: Vehicle[] = [];

  for (const activity of vehicleActivities) {
    const line = getTagValue(activity, "LineRef") ?? getTagValue(activity, "PublishedLineName");
    if (!line || !trackedServices.has(line)) {continue;}
    const recordedAt = getTagValue(activity, "RecordedAtTime");
    if (!recordedAt) {continue;}
    const recordedTime = Date.parse(recordedAt);
    if (Number.isNaN(recordedTime)) {continue;}
    const ageSeconds = Math.floor((Date.now() - recordedTime) / 1000);
    if (ageSeconds > GHOST_VEHICLE_AGE_SECONDS) {continue;}
    const vehicleId = getTagValue(activity, "VehicleRef");
    if (!vehicleId) {continue;}

    const locationMatch = activity.match(/<VehicleLocation>[\s\S]*?<Longitude>([^<]+)<\/Longitude>[\s\S]*?<Latitude>([^<]+)<\/Latitude>[\s\S]*?<\/VehicleLocation>/);

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
    if (isInsideGeofence(latitude,longitude,line,geofences)) {
      continue;
    }

    const operatorCode = getTagValue(activity, "OperatorRef") ?? "";

    const journeyId = getTagValue(activity, "DatedVehicleJourneyRef") ?? "";

    const vehicle: Vehicle = {
      vehicle_id: vehicleId,
      operator: operatorCode,
      operator_code: operatorCode,
      route: line,
      direction:
        getTagValue(activity, "DirectionRef") ?? "",
      origin: cleanText(getTagValue(activity, "OriginName") ?? ""),
      destination: cleanText(getTagValue(activity, "DestinationName") ?? ""),
      latitude,
      longitude,
      bearing: Number(getTagValue(activity, "Bearing") ?? 0),
      speed_mps: 0,
      occupancy: "",
      recorded_at:
        getTagValue(activity, "RecordedAtTime") ??
        new Date().toISOString(),
      journey_id: journeyId,
    };

    vehicles.push(vehicle);
  }

  console.log(`Matching vehicles: ${vehicles.length}`);

const generatedAt = new Date();

let dataAgeSeconds = 0;

if (vehicles.length > 0) {
  const recordedTimes = vehicles
    .map((vehicle) => Date.parse(vehicle.recorded_at))
    .filter((time) => Number.isFinite(time));

  if (recordedTimes.length > 0) {
    const oldestRecordedTime = Math.min(...recordedTimes);

    dataAgeSeconds = Math.max(
      0,
      Math.floor(
        (generatedAt.getTime() - oldestRecordedTime) / 1000
      )
    );
  }
}

return {
  schema_version: 1,
  generated_at: generatedAt.toISOString(),
  source: "live",
  status: "live",
  data_age_seconds: dataAgeSeconds,
  vehicle_count: vehicles.length,
  vehicles,
};
}
