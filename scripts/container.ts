import type { Vehicle } from "./types";
import { fetchBodsData } from "./fetch-bods-new";
import { fetchMegaBusData } from "./fetch-megabus-new";
import { fetchFlixData } from "./fetch-flix";

const [bods, megabus, flix] = await Promise.all([
  fetchBodsData(),
  fetchMegaBusData(),
  fetchFlixData(),
]);

const vehicles: Vehicle[] = [
  ...bods,
  ...megabus,
  ...flix,
];

console.log(`BODS: ${bods.length} vehicles`);
console.log(`MegaBus: ${megabus.length} vehicles`);
console.log(`FlixBus: ${flix.length} vehicles`);
console.log(`Total: ${vehicles.length} vehicles`);
