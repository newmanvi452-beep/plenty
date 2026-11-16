// Local stand-in for Supabase, for development and tests only. Runs supabase/schema.sql in an
// in-memory Postgres and serves the same APIs the app calls:
//   POST /rest/v1/rpc/<function>        shared menus
//   POST /auth/v1/otp, /verify, /token  email-code sign-in (the code is always 123456 here)
//   GET|POST|DELETE /rest/v1/user_data  per-user saved data, protected by the real row level security
//   node supabase/mock-server.mjs       (listens on http://localhost:54321)
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const CODE = "123456";
const db = new PGlite();
await db.exec("create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;");
// Minimal stand-in for Supabase's auth schema: auth.uid() reads the signed-in user, like PostgREST does.
await db.exec(`create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;`);
await db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" };
const send = (res, code, body) => {
  res.writeHead(code, { ...cors, ...(body === undefined ? {} : { "Content-Type": "application/json" }) });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};
const uuidFor = (email) => { const h = createHash("md5").update(email.toLowerCase()).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };
const tokens = (uid, email) => {
  const expires_at = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: `mock.${uid}.${expires_at}`, refresh_token: `refresh.${uid}.${email}`, token_type: "bearer", expires_in: 3600, expires_at, user: { id: uid, email } };
};
const userOf = (req) => {
  const m = /^Bearer mock\.([0-9a-f-]{36})\.(\d+)$/.exec(req.headers.authorization || "");
  return m && Number(m[2]) > Date.now() / 1000 ? m[1] : null;
};

async function asRole(role, uid, fn) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  try { return await fn(); } finally { await db.exec("reset role"); }
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  let raw = "";
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const url = req.url || "";
  try {
    // ---- sign-in ----
    if (url === "/auth/v1/otp") { console.log(`[mock] sign-in code for ${body.email}: ${CODE}`); return send(res, 200, {}); }
    if (url === "/auth/v1/verify") {
      if (String(body.token) !== CODE) return send(res, 400, { code: 400, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      const uid = uuidFor(body.email);
      await db.query("insert into auth.users (id, email) values ($1, $2) on conflict do nothing", [uid, body.email]);
      return send(res, 200, tokens(uid, body.email));
    }
    if (url.startsWith("/auth/v1/token")) {
      const m = /^refresh\.([0-9a-f-]{36})\.(.+)$/.exec(body.refresh_token || "");
      return m ? send(res, 200, tokens(m[1], m[2])) : send(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
    }
    if (url === "/auth/v1/logout") return send(res, 204);

    // ---- per-user saved data (row level security does the access control) ----
    if (url.startsWith("/rest/v1/user_data")) {
      const uid = userOf(req);
      if (!uid) return send(res, 401, { message: "JWT expired or missing" });
      if (req.method === "GET") return send(res, 200, (await asRole("authenticated", uid, () => db.query("select data, updated_at from user_data"))).rows);
      if (req.method === "POST") {
        await asRole("authenticated", uid, () => db.query(
          "insert into user_data (user_id, data, updated_at) values ($1, $2::jsonb, $3) on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at",
          [body.user_id, JSON.stringify(body.data), body.updated_at]));
        return send(res, 201);
      }
      if (req.method === "DELETE") { await asRole("authenticated", uid, () => db.query("delete from user_data")); return send(res, 204); }
    }

    // ---- shared menus ----
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url);
    if (req.method !== "POST" || !m) return send(res, 404, { message: "not found" });
    const keys = Object.keys(body);
    const named = keys.map((k, i) => k + " => $" + (i + 1)).join(", ");
    const values = keys.map((k) => (body[k] !== null && typeof body[k] === "object" ? JSON.stringify(body[k]) : body[k]));
    const rows = (await asRole("anon", "", () => db.query("select public." + m[1] + "(" + named + ") as r", values))).rows;
    const r = rows[0] ? rows[0].r : undefined;
    if (r === "" || r === undefined) return send(res, 204);
    return send(res, 200, r);
  } catch (e) {
    return send(res, 400, { message: String(e.message || e).replace(/^error: /i, "") });
  }
}).listen(54321, () => console.log("mock Supabase on http://localhost:54321"));
