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
  await db.exec("create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;");
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
