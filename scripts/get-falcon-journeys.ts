console.log("I'll try to get the Journey Data from those sneaky devs at MegaBus!");

const url = "https://megabus.tmpanel.co.uk/Tracker/GetJourney";

const body = new URLSearchParams({
  FromStage: "",
  ToStage: "",
  RouteID: "FALC",
  TicketNumber: "",
  IsStageSelection: "0",
});

console.log("I'll try to get the Journey Data from those sneaky devs at MegaBus!");

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
console.log(text.slice(0, 500));
