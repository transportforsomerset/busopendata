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

type MegaBusResponse = {
  OpStatus?: string;
  Message?: string;
  entity?: string;
};

type MegaBusEntity = {
  Table?: Array<Record<string, unknown>>;
  Table1?: Array<Record<string, unknown>>;
  Table2?: Array<Record<string, unknown>>;
  Table3?: Array<Record<string, unknown>>;
};

function getValue(
  row: Record<string, unknown>,
  ...names: string[]
): string | null {
  for (const name of names) {
    const value = row[name];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
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
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://megabus.tmpanel.co.uk/Tracker",
      },
      body: body.toString(),
      signal: controller.signal,
    });

    console.log(
      `MegaBus ${journey.jrny_id}: HTTP ${response.status} ${response.statusText}`
    );

    console.log(
      `MegaBus ${journey.jrny_id}: Content-Type =`,
      response.headers.get("content-type")
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`
      );
    }

    const raw = await response.text();

    let data: MegaBusResponse;

    try {
      data = JSON.parse(raw) as MegaBusResponse;
    } catch {
      throw new Error(
        `MegaBus ${journey.jrny_id}: response was not valid JSON`
      );
    }

    if (data.OpStatus !== "SUCCESS") {
      console.log(
        `MegaBus ${journey.jrny_id}: ${data.OpStatus ?? "unknown status"} - ${data.Message ?? ""}`
      );

      return null;
    }

    if (!data.entity) {
      console.log(
        `MegaBus ${journey.jrny_id}: response contained no entity data`
      );

      return null;
    }

    let entity: MegaBusEntity;

    try {
      entity = JSON.parse(data.entity) as MegaBusEntity;
    } catch {
      throw new Error(
        `MegaBus ${journey.jrny_id}: entity was not valid JSON`
      );
    }

    const journeyRows = Array.isArray(entity.Table)
      ? entity.Table
      : [];

    const isLiveJourney =
      journeyRows.length > 0 &&
      Number(getValue(journeyRows[0], "IsLiveJourney")) === 1;

    if (!isLiveJourney) {
      console.log(
        `MegaBus ${journey.jrny_id}: journey is not live`
      );

      return null;
    }

    const liveRows = Array.isArray(entity.Table2)
      ? entity.Table2
      : [];

    if (liveRows.length === 0) {
      console.log(
        `MegaBus ${journey.jrny_id}: no live position`
      );

      return null;
    }

    const live = liveRows[0];

    const latitude = Number(getValue(live, "Lat"));
    const longitude = Number(getValue(live, "Lng"));

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      console.log(
        `MegaBus ${journey.jrny_id}: invalid live position`
      );

      return null;
    }

    const recordedAt =
      getValue(live, "GeoDtTime") ??
      new Date().toISOString();

    const busReg =
      getValue(live, "BusReg") ??
      journey.vehicle;

    const occupancy =
      getValue(live, "Occupancy");

    console.log(
      `MegaBus ${journey.jrny_id}: live position ${latitude}, ${longitude} (${busReg})`
    );

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
      speed_mps: speed_mps: 100 / 2.23694,
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
    const contents = await fs.readFile(
      configPath,
      "utf8"
    );

    const config = JSON.parse(
      contents
    ) as MegaBusConfig;

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
      (vehicle): vehicle is MegaBusVehicle =>
        vehicle !== null
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
