const fs = require("fs");
function logEvent(event) {
  fs.appendFileSync("execution-log.jsonl", JSON.stringify({ time: new Date().toISOString(), ...event }) + "\n");
}
module.exports = { logEvent };
