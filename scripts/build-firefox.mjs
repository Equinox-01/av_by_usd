/**
 * Writes dist/firefox/ with manifest for AMO: background.scripts only (no service_worker key),
 * so Firefox linters do not warn about an "ignored" service_worker field. Chrome builds use
 * manifest.json at repo root as usual.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "dist", "firefox");
const srcOut = path.join(out, "src");

fs.mkdirSync(out, { recursive: true });
fs.rmSync(srcOut, { recursive: true, force: true });
fs.cpSync(path.join(root, "src"), srcOut, { recursive: true });

const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const sw = m.background.service_worker;
if (!sw || typeof sw !== "string") {
  throw new Error("manifest.json must set background.service_worker to the worker script path");
}
m.background = { scripts: [sw] };
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(m, null, 2) + "\n");

console.log("Wrote dist/firefox/ (AMO: background.scripts, no service_worker in manifest).");
