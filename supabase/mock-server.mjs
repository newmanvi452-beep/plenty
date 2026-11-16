// Local stand-in for Supabase, for development and tests only: runs supabase/schema.sql in an
// in-memory Postgres and serves the same  POST /rest/v1/rpc/<function>  API the app calls.
//   node supabase/mock-server.mjs         (listens on http://localhost:54321)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const db = new PGlite();
await db.exec("create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;");
await db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };

createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(req.url || "");
  if (req.method !== "POST" || !m) { res.writeHead(404, cors); return res.end(); }
  let raw = "";
  for await (const c of req) raw += c;
  try {
    const args = JSON.parse(raw || "{}");
    const keys = Object.keys(args);
    const named = keys.map((k, i) => k + " => $" + (i + 1)).join(", ");
    const values = keys.map((k) => (args[k] !== null && typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k]));
    await db.exec("set role anon");
    let rows;
    try { rows = (await db.query("select public." + m[1] + "(" + named + ") as r", values)).rows; }
    finally { await db.exec("reset role"); }
    const r = rows[0] ? rows[0].r : undefined;
    if (r === "" || r === undefined) { res.writeHead(204, cors); return res.end(); }
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify(r));
  } catch (e) {
    res.writeHead(400, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: String(e.message || e).replace(/^error: /i, "") }));
  }
}).listen(54321, () => console.log("mock Supabase on http://localhost:54321"));
