import type { MegaBusConfig, MegaBusEntity, MegaBusJourney, MegaBusResponse, Vehicle } from "./types";

// Needed for debugging with our test action.
const debug = process.argv.includes("--debug");

const MEGABUS_JOURNEY_URL = "https://megabus.tmpanel.co.uk/Tracker/GetJourney";
const MEGABUS_TRACKING_URL = "https://megabus.tmpanel.co.uk/Tracker/GetJourneyStage";
const REQUEST_TIMEOUT_MS = 5000;

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

async function getFalconJourneys(): Promise<MegaBusJourney[]> {
  const body = new URLSearchParams({
    FromStage: "",
    ToStage: "",
    RouteID: "57",
    TicketNumber: "",
    IsStageSelection: "false",
  });

  const response = await fetch(MEGABUS_JOURNEY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  console.log(
    `MegaBus GetJourney: HTTP ${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    throw new Error(
      `MegaBus GetJourney failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data.OpStatus !== "SUCCESS") {
    throw new Error(
      data.Message || "MegaBus GetJourney returned an error."
    );
  }

  const journeyList = data.JourneyList as string;

  if (typeof journeyList !== "string") {
    throw new Error(
      "MegaBus GetJourney response contained no JourneyList."
    );
  }

  console.log(
    `MegaBus GetJourney: response length ${journeyList.length}`
  );

  const journeys = [
    ...journeyList.matchAll(
      /<div[^>]+class="[^"]*\bcls-jrny\b[^"]*"[^>]*>/g
    ),
  ].map((match): MegaBusJourney => {
    const card = match[0];

    const getAttribute = (name: string): string => {
      const attribute = card.match(
        new RegExp(`data-${name}="([^"]*)"`)
      );

      return attribute?.[1] ?? "";
    };

    return {
      jrny_id: getAttribute("jrnyid"),
      journey_id: getAttribute("journeyid"),
      route: getAttribute("routeno"),
      origin: getAttribute("startstage"),
      destination: getAttribute("endstage"),
      departure: getAttribute("startdate"),
      arrival: getAttribute("endtime"),
      duration: getAttribute("duration"),
      is_live: getAttribute("islive"),
      vehicle: getAttribute("busreg"),
    };
  });

  console.log(
    `MegaBus GetJourney: found ${journeys.length} journeys.`
  );

  for (const journey of journeys) {
    console.log(
      `${journey.jrny_id} | ` +
      `${journey.journey_id} | ` +
      `${journey.route} | ` +
      `${journey.departure} | ` +
      `${journey.origin} → ${journey.destination} | ` +
      `${journey.vehicle || "scheduled"} | ` +
      `${journey.is_live === "1" ? "LIVE" : "scheduled"}`
    );
  }

  return journeys;
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

    const response = await fetch(MEGABUS_TRACKING_URL, {
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
        `MegaBus ${journey.jrny_id}: ` +
        `${data.OpStatus ?? "unknown status"} - ` +
        `${data.Message ?? ""}`
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

    console.log(
      `MegaBus ${journey.jrny_id}: Table =`,
      JSON.stringify(journeyRows)
    );

    const liveJourneyStatus =
  journeyRows.length > 0
    ? Number(getValue(journeyRows[0], "IsLiveJourney"))
    : 0;

const isLiveJourney =
  liveJourneyStatus === 1 ||
  liveJourneyStatus === 2;

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

    const latitude = Number(
      getValue(live, "Lat")
    );

    const longitude = Number(
      getValue(live, "Lng")
    );

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

    if (!busReg) {
      console.log(
        `MegaBus ${journey.jrny_id}: live vehicle has no registration`
      );

      return null;
    }

    const occupancy =
      getValue(live, "Occupancy");

    console.log(
      `MegaBus ${journey.jrny_id}: ` +
      `live position ${latitude}, ${longitude} (${busReg.trim()})`
    );

    return {
      vehicle_id: busReg.trim(),
      operator_code: "SCCO",
      operator: "MegaBus",
      route: journey.route,
      origin: journey.origin,
      destination: journey.destination,
      latitude,
      longitude,
      recorded_at: recordedAt,
      bearing: null,
      occupancy,
      journey_id: journey.jrny_id,
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
  try {
    const journeys = await getFalconJourneys();

    const config: MegaBusConfig = {
      operator: "SCCO",
      route: "FALC",
      services: journeys,
    };

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

if (import.meta.main) {
  await fetchMegaBusData();
}
