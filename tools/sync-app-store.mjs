// Copies Serves 20 download counts from App Store Connect into the admin dashboard.
// Runs daily on the owner's Mac (see tools/README-sync.md). Apple publishes each day's numbers about a day late.
// Settings live in ~/.serves20/sync.json:  { p8, keyId, issuerId, vendor, appId, supabaseUrl, anonKey, token }
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto"; import zlib from "node:zlib";

const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".serves20", "sync.json"), "utf8"));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt() {
  const h = b64({ alg: "ES256", kid: cfg.keyId, typ: "JWT" }), n = Math.floor(Date.now() / 1000);
  const p = b64({ iss: cfg.issuerId, iat: n, exp: n + 600, aud: "appstoreconnect-v1" });
  const sig = crypto.sign("sha256", Buffer.from(`${h}.${p}`), { key: fs.readFileSync(cfg.p8), dsaEncoding: "ieee-p1363" });
  return `${h}.${p}.${sig.toString("base64url")}`;
}
const token = jwt();
const asc = (u) => fetch(`https://api.appstoreconnect.apple.com${u}`, { headers: { Authorization: `Bearer ${token}` } });

const app = await (await asc(`/v1/apps/${cfg.appId}?fields%5Bapps%5D=sku`)).json();
const sku = app?.data?.attributes?.sku;
if (!sku) throw new Error("Could not read the app from App Store Connect");

const DOWNLOAD = new Set(["1", "1F", "1T", "F1"]), REDOWNLOAD = new Set(["3", "3F", "3T"]), UPDATE = new Set(["7", "7F", "7T"]);
const days = Number(process.argv[2] || 14);
const rows = [];
for (let i = 1; i <= days; i++) {
  const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
  const q = `filter%5Bfrequency%5D=DAILY&filter%5BreportType%5D=SALES&filter%5BreportSubType%5D=SUMMARY&filter%5BvendorNumber%5D=${cfg.vendor}&filter%5BreportDate%5D=${d}&filter%5Bversion%5D=1_1`;
  const r = await asc(`/v1/salesReports?${q}`);
  const row = { day: d, downloads: 0, redownloads: 0, updates: 0, purchases: 0 };
  if (r.status === 200) {
    const lines = zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString().split("\n");
    const head = lines[0].split("\t"), col = (n) => head.indexOf(n);
    for (const line of lines.slice(1)) {
      const c = line.split("\t"); if (c.length < head.length) continue;
      const type = c[col("Product Type Identifier")], units = Number(c[col("Units")]) || 0;
      const mine = c[col("Apple Identifier")] === String(cfg.appId) || c[col("Parent Identifier")] === sku;
      if (!mine) continue;
      if (DOWNLOAD.has(type)) row.downloads += units; else if (REDOWNLOAD.has(type)) row.redownloads += units;
      else if (UPDATE.has(type)) row.updates += units; else if (type.startsWith("IA")) row.purchases += units;
    }
  } else if (r.status !== 404) { console.error(d, "Apple said", r.status); continue; }
  rows.push(row);
}
const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/ingest_downloads`, {
  method: "POST", headers: { apikey: cfg.anonKey, "Content-Type": "application/json", ...(cfg.anonKey.startsWith("eyJ") ? { Authorization: `Bearer ${cfg.anonKey}` } : {}) },
  body: JSON.stringify({ p_token: cfg.token, p_rows: rows }),
});
console.log(new Date().toISOString(), "saved", rows.length, "days:", res.status, (await res.text()).slice(0, 100));
