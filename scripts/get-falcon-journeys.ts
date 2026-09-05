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

const text = await response.text();

console.log(`Response length: ${text.length}`);
console.log(text.slice(0, 1000));
