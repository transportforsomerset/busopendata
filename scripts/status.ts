/* Is the BODS data accessible, is there any problems? */

import type { BusData, DataStatus, StatusData } from "./types";

export function calculateDataAge(generatedAt: string): number {
  const generated = Date.parse(generatedAt);

  if (Number.isNaN(generated)) {
    throw new Error(`Invalid generated_at timestamp: ${generatedAt}`);
  }

  const ageMilliseconds = Date.now() - generated;

  return Math.max(0, Math.floor(ageMilliseconds / 1000));
}

export function determineStatus(
  source: BusData["source"],
  ageSeconds: number
): DataStatus {
  // Development data is always explicitly identified as sample data.
  if (source === "sample") {
    return "sample";
  }

  // BODS live data is considered live for up to 10 minutes.
  if (source === "live" && ageSeconds <= 600) {
    return "live";
  }

  // Raspberry Pi live data will use the stricter threshold later.
  if (source === "pi" && ageSeconds <= 60) {
    return "live";
  }

  // GitHub Actions backup data can be up to 10 minutes old.
  if (source === "github" && ageSeconds <= 600) {
    return "backup";
  }

  return "stale";
}

export function createStatusData(
  busData: BusData,
  checkedAt: string = new Date().toISOString()
): StatusData {
  const dataAgeSeconds = calculateDataAge(busData.generated_at);
  const status = determineStatus(busData.source, dataAgeSeconds);

  let message: string;

  switch (status) {
    case "live":
      message = "Live bus data is available.";
      break;

    case "backup":
      message = "Live data is unavailable. Showing backup data.";
      break;

    case "stale":
      message = "Bus data is older than expected.";
      break;

    case "sample":
      message = "Using sample development data.";
      break;
  }

  return {
    schema_version: 1,
    status,
    source: busData.source,
    generated_at: busData.generated_at,
    checked_at: checkedAt,
    data_age_seconds: dataAgeSeconds,
    vehicle_count: busData.vehicles.length,
    message,
  };
}
