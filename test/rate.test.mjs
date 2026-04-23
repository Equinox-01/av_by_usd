import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ratePath = join(__dirname, "../src/rate.js");
const code = readFileSync(ratePath, "utf8");

const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { bynTextToUsdString, formatUsd, parseBynNumber } = sandbox.AvByUsdRate;
assert(sandbox.AvByUsdRate);
assert(!Object.prototype.hasOwnProperty.call(sandbox.AvByUsdRate, "PRICE_PATTERN"));

test("bynTextToUsdString converts simple BYN label", () => {
  const out = bynTextToUsdString("100 р.", 2.5);
  assert.equal(out, "~$40");
});

test("bynTextToUsdString leaves text unchanged when no rate", () => {
  const t = "100 р.";
  assert.equal(bynTextToUsdString(t, 0), t);
  assert.equal(bynTextToUsdString(t, -1), t);
});

test("bynTextToUsdString does not change amounts below MIN_BYN", () => {
  const t = "0,50 р.";
  const out = bynTextToUsdString(t, 2.5);
  assert.equal(out, t);
});

test("formatUsd rounds up", () => {
  assert.equal(formatUsd(1.1), "~$2");
  assert.equal(formatUsd(1.0), "~$1");
});

test("parseBynNumber", () => {
  assert.equal(parseBynNumber("1 000"), 1000);
  assert.equal(parseBynNumber("1,5"), 1.5);
  assert.equal(parseBynNumber("2.29"), 2.29);
  assert.equal(parseBynNumber("1.234"), 1234);
  assert.equal(parseBynNumber("1 234,56"), 1234.56);
});

test("bynTextToUsdString: decimal with dot does not split (e.g. 2.29 р, not 2 + 29 р)", () => {
  const rate = 2.5;
  assert.equal(bynTextToUsdString("1 USD = 2,29 р", rate), "1 USD = ~$1");
  assert.equal(bynTextToUsdString("1 USD = 2.29 р", rate), "1 USD = ~$1");
});
