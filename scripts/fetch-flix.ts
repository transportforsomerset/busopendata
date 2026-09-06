const debug = process.argv.includes("--debug");

console.log("Flix isn't LIVE yet!");

if (debug) {
  console.log("--debug: true");
} else {
  console.log("--debug: not found");
}
