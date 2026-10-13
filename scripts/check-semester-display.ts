import assert from "node:assert/strict";
import { useFocusLayout, inNextSevenDays } from "../lib/semester-display";
assert.equal(useFocusLayout(null), true);
assert.equal(useFocusLayout("focus"), true);
assert.equal(useFocusLayout("full"), false);
assert.equal(useFocusLayout("invalid"), true);
for (const date of ["2026-10-14", "2026-10-20"]) assert.equal(inNextSevenDays(date, "2026-10-14"), true);
for (const date of [undefined, "2026-10-13", "2026-10-21", "invalid"]) assert.equal(inNextSevenDays(date, "2026-10-14"), false);
assert.equal(inNextSevenDays("2026-10-06", "2026-09-30"), true); // Sydney DST transition
assert.equal(inNextSevenDays("2026-10-07", "2026-09-30"), false);
assert.equal(inNextSevenDays("2027-01-03", "2026-12-29"), true);
console.log("PASS: Focus defaults, saved layout choice, seven calendar dates, DST and year boundaries.");
