// Sanity test for the light-rig scaler.
// Extracts the pure logic from index.html and verifies the core invariants
// without needing a browser. Run: `npm test`  (or `node test/sanity.cjs`). Node 18+.

const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("FAIL: <script> block not found in index.html");
  process.exit(1);
}

// The script guards its UI in `if (typeof document !== "undefined")`, so under
// node only the pure logic + module.exports run.
const tmp = path.join(__dirname, "_lightrig.tmp.cjs");
fs.writeFileSync(tmp, m[1]);

let L;
try {
  L = require(tmp);
} finally {
  fs.unlinkSync(tmp);
}

const { REF_DEFAULT, TEMPLATE, computeAll, generateT3D } = L;

let failed = 0;
function check(name, cond) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failed++;
}

// 1. Identity: reference dimensions reproduce the source rig byte-for-byte.
check(
  "identity A (453x274x77) === TEMPLATE",
  generateT3D(computeAll(453, 274, 77, "A", false, REF_DEFAULT)) === TEMPLATE
);
check(
  "identity B (453x274x77) === TEMPLATE",
  generateT3D(computeAll(453, 274, 77, "B", false, REF_DEFAULT)) === TEMPLATE
);

// 2. A scaled case changes the output but preserves structure.
const scaled = generateT3D(computeAll(600, 300, 80, "A", false, REF_DEFAULT));
check("scaled (600x300x80) differs from TEMPLATE", scaled !== TEMPLATE);
check("scaled keeps 5 actors", (scaled.match(/Begin Actor/g) || []).length === 5);
check(
  "scaled keeps line count",
  scaled.split("\n").length === TEMPLATE.split("\n").length
);

// 3. No branding leaks into generated output.
check("no 'RH' in output", !/RH/.test(scaled));
check("no '3dsource' in output", !/3dsource/i.test(scaled));

if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll checks passed.");
