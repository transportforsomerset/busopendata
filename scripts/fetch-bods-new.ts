const debug = process.argv.includes("--debug");

console.log("New BODS pending!");

if (debug) {
  console.log("--debug: true");
} else {
  console.log("--debug: not found");
}
