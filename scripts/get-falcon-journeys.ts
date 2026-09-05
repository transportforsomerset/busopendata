const url = "https://megabus.tmpanel.co.uk/Tracker/GetJourney";

const body = new URLSearchParams({
  FromStage: "",
  ToStage: "",
  RouteID: "57",
  TicketNumber: "",
  IsStageSelection: "false",
});

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: body.toString(),
});

console.log(`HTTP status: ${response.status}`);

if (!response.ok) {
  throw new Error(`HTTP ${response.status} ${response.statusText}`);
}

const data = await response.json();

if (data.OpStatus !== "SUCCESS") {
  throw new Error(data.Message || "MegaBus returned an error.");
}

const journeyList = data.JourneyList as string;

console.log(`Response length: ${journeyList.length}`);

// Find every journey card in JourneyList.
const journeys = [...journeyList.matchAll(
  /<div[^>]+class="[^"]*\bcls-jrny\b[^"]*"[^>]*>/g
)].map((match) => {
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

console.log(`\nFound ${journeys.length} journeys:\n`);

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
