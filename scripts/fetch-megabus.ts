import fs from "fs/promises";
import path from "path";

const MEGABUS_URL =
  "https://megabus.tmpanel.co.uk/Tracker/GetJourneyStage";

const REQUEST_TIMEOUT_MS = 5000;

type MegaBusJourney = {
  jrny_id: string;
  journey_id: string;
  vehicle: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
};

type MegaBusConfig = {
  operator: string;
  route: string;
  services: MegaBusJourney[];
};

type MegaBusVehicle = {
  vehicle_id: string;
  operator_code: string;
  operator: string;
  route: string;
  origin: string;
  destination: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  speed_mps: number | null;
  occupancy: string | null;
};

function getValue(
  row: Record<string, unknown>,
  ...names: string[]
): string | null {
  for (const name of names) {
    const value = row[name];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return null;
}

async function fetchJourneyStage(
  journey: MegaBusJourney
): Promise<MegaBusVehicle | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const body = new URLSearchParams({
      JrnyID: journey.jrny_id,
      JourneyID: journey.journey_id,
    });

    const response = await fetch(MEGABUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    const liveRows = Array.isArray(data.Table2)
      ? data.Table2
      : [];

    if (liveRows.length === 0) {
      console.log(
        `MegaBus ${journey.jrny_id}: no live position`
      );
      return null;
    }

    const live = liveRows[0] as Record<string, unknown>;

    const latitude = Number(getValue(live, "Lat"));
    const longitude = Number(getValue(live, "Lng"));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.log(
        `MegaBus ${journey.jrny_id}: invalid position`
      );
      return null;
    }

    const recordedAt =
      getValue(live, "GeoDtTime") ?? new Date().toISOString();

    const busReg =
      getValue(live, "BusReg") ?? journey.vehicle;

    const occupancy = getValue(live, "Occupancy");

    return {
      vehicle_id: busReg,
      operator_code: "SCCO",
      operator: "MegaBus",
      route: "FALC",
      origin: journey.origin,
      destination: journey.destination,
      latitude,
      longitude,
      recorded_at: recordedAt,
      speed_mps: null,
      occupancy: occupancy || null,
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.error(
        `MegaBus ${journey.jrny_id}: request timed out`
      );
    } else {
      console.error(
        `MegaBus ${journey.jrny_id}:`,
        error
      );
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMegaBusData(): Promise<MegaBusVehicle[]> {
  const configPath = path.join(
    process.cwd(),
    "data",
    "megabus.json"
  );

  try {
    const contents = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(contents) as MegaBusConfig;

    if (!Array.isArray(config.services)) {
      throw new Error(
        "data/megabus.json does not contain a services array."
      );
    }

    console.log(
      `Tracking ${config.services.length} MegaBus journeys...`
    );

    const results = await Promise.all(
      config.services.map(fetchJourneyStage)
    );

    const vehicles = results.filter(
      (vehicle): vehicle is MegaBusVehicle => vehicle !== null
    );

    console.log(
      `MegaBus returned ${vehicles.length} live vehicles.`
    );

    return vehicles;
  } catch (error) {
    console.error("ERROR: MegaBus fetch failed.");
    console.error(error);

    return [];
  }
}
