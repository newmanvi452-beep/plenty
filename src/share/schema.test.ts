// Runs supabase/schema.sql in a real Postgres (PGlite) and checks who can do what.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const SNAP = JSON.stringify({ dishes: [{ id: "mash", name: "Mashed potatoes" }, { id: "pie", name: "Pie" }] });
const TOKEN = "owner-secret-token-0123456789";
let db: PGlite;
const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as any[];
const asAnon = async <T,>(fn: () => Promise<T>) => { await db.exec("set role anon"); try { return await fn(); } finally { await db.exec("reset role"); } };
const create = async (token = TOKEN) => (await q("select create_shared_event($1,'tg','Thanksgiving','2026-11-26',960,10,2,$2::jsonb) as s", [token, SNAP]))[0].s as string;
const get = async (slug: string) => (await q("select get_shared_event($1) as e", [slug]))[0].e;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin; grant usage on schema public to anon, authenticated, service_role;");
  // Minimal stand-in for Supabase's auth schema: auth.uid() reads the signed-in user from a setting, like PostgREST does.
  await db.exec(`create schema auth;
    create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;`);
  await db.exec(readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8"));
});

describe("shared menu backend", () => {
  it("anon cannot read or write the tables directly", async () => {
    await expect(asAnon(() => q("select * from shared_events"))).rejects.toThrow(/permission denied/);
    await expect(asAnon(() => q("select * from claims"))).rejects.toThrow(/permission denied/);
    await expect(asAnon(() => q("insert into claims(event_id,name,what,owner_key) values (gen_random_uuid(),'x','y','0123456789abcdef')"))).rejects.toThrow(/permission denied/);
  });

  it("creates a share and returns it by slug, never exposing the token or hash", async () => {
    const slug = await asAnon(() => create());
    expect(slug).toMatch(/^[0-9a-f]{16}$/);
    const e = await asAnon(() => get(slug));
    expect(e).toMatchObject({ slug, mode: "tg", title: "Thanksgiving", event_date: "2026-11-26", serve_min: 960, adults: 10, kids: 2, claims: [] });
    expect(JSON.stringify(e)).not.toMatch(/edit_hash|owner_key|owner-secret/);
    expect(await asAnon(() => get("doesnotexist"))).toBeNull();
  });

  it("only the owner can update or delete", async () => {
    const slug = await asAnon(() => create());
    const upd = (token: string) => q("select update_shared_event($1,$2,'New title',null,null,5,1,$3::jsonb)", [slug, token, SNAP]);
    await expect(asAnon(() => upd("wrong-token-wrong-token-1"))).rejects.toThrow(/not allowed/);
    await asAnon(() => upd(TOKEN));
    expect((await asAnon(() => get(slug))).title).toBe("New title");
    await expect(asAnon(() => q("select delete_shared_event($1,'wrong-token-wrong-token-1')", [slug]))).rejects.toThrow(/not allowed/);
    await asAnon(() => q("select delete_shared_event($1,$2)", [slug, TOKEN]));
    expect(await asAnon(() => get(slug))).toBeNull();
  });

  it("guests claim a dish once, and can claim extras", async () => {
    const slug = await asAnon(() => create());
    const claim = (dish: string | null, what: string | null, name: string, key = "guest-key-0123456789") =>
      asAnon(async () => (await q("select claim_dish($1,$2,$3,$4,$5) as id", [slug, dish, what, name, key]))[0].id as string);
    await claim("mash", null, "Aunt May");
    await expect(claim("mash", null, "Bob")).rejects.toThrow(/already claimed/);
    await expect(claim("nope", null, "Bob")).rejects.toThrow(/not on menu/);
    await claim(null, "ice", "Bob");
    await claim(null, "ice", "Cara"); // extras are free text; duplicates are fine
    const e = await asAnon(() => get(slug));
    expect(e.claims.map((c: any) => [c.dish_id, c.what, c.name])).toEqual([["mash", null, "Aunt May"], [null, "ice", "Bob"], [null, "ice", "Cara"]]);
  });

  it("validates names and enforces the claim cap", async () => {
    const slug = await asAnon(() => create());
    const claim = (name: string, what: string | null = "x") => asAnon(() => q("select claim_dish($1,null,$2,$3,'guest-key-0123456789')", [slug, what, name]));
    await expect(claim("")).rejects.toThrow();
    await expect(claim("x".repeat(41))).rejects.toThrow();
    await expect(claim("Ok", "y".repeat(81))).rejects.toThrow();
    for (let i = 0; i < 150; i++) await q("insert into claims(event_id,what,name,owner_key) select id,'x','g','0123456789abcdef' from shared_events where slug=$1", [slug]);
    await expect(claim("One too many")).rejects.toThrow(/too many/);
  });

  it("a guest can remove only their own claim; the owner can remove any", async () => {
    const slug = await asAnon(() => create());
    const claim = (dish: string, name: string, key: string) => asAnon(async () => (await q("select claim_dish($1,$2,null,$3,$4) as id", [slug, dish, name, key]))[0].id as string);
    const a = await claim("mash", "Aunt May", "may-key-0123456789ab");
    const b = await claim("pie", "Bob", "bob-key-0123456789ab");
    await expect(asAnon(() => q("select unclaim($1,$2,'bob-key-0123456789ab')", [slug, a]))).rejects.toThrow(/not allowed/);
    await asAnon(() => q("select unclaim($1,$2,'may-key-0123456789ab')", [slug, a]));
    await expect(asAnon(() => q("select unclaim($1,$2,null,'wrong-token-wrong-token-1')", [slug, b]))).rejects.toThrow(/not allowed/);
    await asAnon(() => q("select unclaim($1,$2,null,$3)", [slug, b, TOKEN]));
    expect((await asAnon(() => get(slug))).claims).toEqual([]);
  });

  it("deleting the event deletes its claims", async () => {
    const slug = await asAnon(() => create());
    await asAnon(() => q("select claim_dish($1,'pie',null,'Bob','bob-key-0123456789ab')", [slug]));
    await asAnon(() => q("select delete_shared_event($1,$2)", [slug, TOKEN]));
    expect((await q("select count(*)::int as n from claims c join shared_events e on e.id=c.event_id where e.slug=$1", [slug]))[0].n).toBe(0);
  });
});

describe("accounts: one private row per user", () => {
  const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
  const asUser = async <T,>(uid: string | null, fn: () => Promise<T>) => {
    await db.exec(`set role ${uid ? "authenticated" : "anon"}`);
    await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  beforeAll(async () => { await db.exec(`insert into auth.users values ('${A}'), ('${B}')`); });

  it("a signed-in user can save and read their own data", async () => {
    await asUser(A, () => q("insert into user_data (data) values ($1::jsonb)", [JSON.stringify({ hello: "A" })]));
    expect((await asUser(A, () => q("select user_id, data from user_data")))).toEqual([{ user_id: A, data: { hello: "A" } }]);
    await asUser(A, () => q("update user_data set data = $1::jsonb, updated_at = now()", [JSON.stringify({ hello: "A2" })]));
    expect((await asUser(A, () => q("select data from user_data")))[0].data).toEqual({ hello: "A2" });
  });
  it("another user sees nothing and cannot change or delete it", async () => {
    await asUser(B, () => q("insert into user_data (data) values ($1::jsonb)", [JSON.stringify({ hello: "B" })]));
    expect((await asUser(B, () => q("select data from user_data"))).map((r) => r.data)).toEqual([{ hello: "B" }]);
    await asUser(B, () => q("update user_data set data = '{\"hacked\":1}'::jsonb where user_id = $1", [A]));
    await asUser(B, () => q("delete from user_data where user_id = $1", [A]));
    expect((await asUser(A, () => q("select data from user_data")))[0].data).toEqual({ hello: "A2" });
  });
  it("cannot write a row under someone else's id", async () => {
    await expect(asUser(B, () => q("insert into user_data (user_id, data) values ($1, '{}'::jsonb)", [A]))).rejects.toThrow(/row-level security|duplicate key/);
  });
  it("signed-out visitors get nothing", async () => {
    await expect(asUser(null, () => q("select * from user_data"))).rejects.toThrow(/permission denied/);
    await expect(asUser(null, () => q("insert into user_data (data) values ('{}'::jsonb)"))).rejects.toThrow(/permission denied/);
  });
  it("a user can delete their own data", async () => {
    await asUser(A, () => q("delete from user_data"));
    expect(await asUser(A, () => q("select * from user_data"))).toEqual([]);
  });
});

describe("admin dashboard and support form", () => {
  const as = async <T,>(role: "anon" | "authenticated", email: string | null, fn: () => Promise<T>) => {
    await db.exec(`set role ${role}`);
    await db.exec(`select set_config('request.jwt.claims', '${email ? JSON.stringify({ email }) : ""}', false)`);
    try { return await fn(); } finally { await db.exec("reset role"); await db.exec("select set_config('request.jwt.claims', '', false)"); }
  };
  const ADMIN = "vi@alevigroup.com";
  it("anyone can send a support request, but cannot read any", async () => {
    await as("anon", null, () => q("select submit_support('guest@example.com','Gus','The code never arrived')"));
    await expect(as("anon", null, () => q("select * from support_requests"))).rejects.toThrow(/permission denied/);
    await expect(as("anon", null, () => q("select admin_support()"))).rejects.toThrow(/permission denied/);
  });
  it("rejects a bad email and an empty message", async () => {
    await expect(as("anon", null, () => q("select submit_support('nope','x','hello there')"))).rejects.toThrow(/bad email/);
    await expect(as("anon", null, () => q("select submit_support('a@b.co','x','  ')"))).rejects.toThrow(/too short/);
  });
  it("limits how many requests one address can send per hour", async () => {
    for (let i = 0; i < 4; i++) await as("anon", null, () => q("select submit_support('spam@example.com',null,'message number "+i+"')"));
    await as("anon", null, () => q("select submit_support('spam@example.com',null,'message number 5')"));
    await expect(as("anon", null, () => q("select submit_support('spam@example.com',null,'message number 6')"))).rejects.toThrow(/too many/);
  });
  it("a signed-in person who is not an admin is refused", async () => {
    await expect(as("authenticated", "someone@example.com", () => q("select admin_overview()"))).rejects.toThrow(/not allowed/);
    await expect(as("authenticated", "someone@example.com", () => q("select admin_support()"))).rejects.toThrow(/not allowed/);
    await expect(as("authenticated", "someone@example.com", () => q("select admin_support_set(gen_random_uuid(),'done')"))).rejects.toThrow(/not allowed/);
    expect((await as("authenticated", "someone@example.com", () => q("select is_admin() as a")))[0].a).toBe(false);
  });
  it("download counts load only with the secret key, and the admin sees them", async () => {
    await db.exec("insert into ingest_keys(hash) values (sha256(convert_to('test-secret','utf8')))");
    const row = JSON.stringify([{ day: new Date().toISOString().slice(0, 10), downloads: 3, purchases: 1 }]);
    await expect(as("anon", null, () => q("select ingest_downloads('wrong', $1::jsonb)", [row]))).rejects.toThrow(/not allowed/);
    await as("anon", null, () => q("select ingest_downloads('test-secret', $1::jsonb)", [row]));
    await expect(as("anon", null, () => q("select * from app_downloads"))).rejects.toThrow(/permission denied/);
    const o = (await as("authenticated", ADMIN, () => q("select admin_overview() as o")))[0].o;
    expect(o).toMatchObject({ downloads_total: 3, purchases_total: 1 });
  });
  it("an admin sees the numbers and the support requests, and can mark one done", async () => {
    const o = (await as("authenticated", ADMIN.toUpperCase(), () => q("select admin_overview() as o")))[0].o;
    expect(o).toMatchObject({ support_open: 6 });
    expect(Array.isArray(o.signups_by_day) && o.signups_by_day.length).toBe(30);
    const list = (await as("authenticated", ADMIN, () => q("select admin_support() as s")))[0].s as { id: string; email: string }[];
    expect(list.some((r) => r.email === "guest@example.com")).toBe(true);
    await as("authenticated", ADMIN, () => q("select admin_support_set($1,'done')", [list[0].id]));
    expect((await as("authenticated", ADMIN, () => q("select admin_overview() as o")))[0].o.support_open).toBe(5);
    expect(Array.isArray((await as("authenticated", ADMIN, () => q("select admin_people() as p")))[0].p)).toBe(true);
  });
});
