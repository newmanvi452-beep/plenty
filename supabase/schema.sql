-- Serves Twenty: shared menus with guest dish claims.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query > paste > Run).
--
-- Security model: the tables are locked (RLS on, no policies, no grants). The app only talks to
-- the functions below, which check what each caller is allowed to do:
--   * anyone with a share link (slug) can read that event and add/remove their own claims
--   * only the owner, who holds the secret edit token, can update or delete the event
--     (the database stores only a hash of the token)

create table if not exists public.shared_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  edit_hash text not null,
  mode text not null check (mode in ('tg', 'party')),
  title text not null check (char_length(title) between 1 and 120),
  event_date date,
  serve_min int check (serve_min between 0 and 1439),
  adults int not null default 0 check (adults between 0 and 200),
  kids int not null default 0 check (kids between 0 and 200),
  snapshot jsonb not null check (octet_length(snapshot::text) < 300000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.shared_events(id) on delete cascade,
  dish_id text,
  name text not null check (char_length(name) between 1 and 40),
  what text check (what is null or char_length(what) between 1 and 80),
  owner_key text not null check (char_length(owner_key) >= 16),
  created_at timestamptz not null default now(),
  -- either a menu dish, or a free-text extra ("ice", "napkins"), never both
  check ((dish_id is not null and what is null) or (dish_id is null and what is not null))
);
create unique index if not exists claims_one_per_dish on public.claims (event_id, dish_id) where dish_id is not null;
create index if not exists claims_event on public.claims (event_id);

alter table public.shared_events enable row level security;
alter table public.claims enable row level security;
revoke all on public.shared_events, public.claims from anon, authenticated;

create or replace function public._hash(t text) returns text
language sql immutable as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;

-- Owner: create a share. Returns the public slug used in the link.
create or replace function public.create_shared_event(
  p_edit_token text, p_mode text, p_title text, p_event_date date, p_serve_min int,
  p_adults int, p_kids int, p_snapshot jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  if p_edit_token is null or char_length(p_edit_token) < 16 then raise exception 'bad token'; end if;
  v_slug := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into shared_events (slug, edit_hash, mode, title, event_date, serve_min, adults, kids, snapshot)
  values (v_slug, _hash(p_edit_token), p_mode, p_title, p_event_date, p_serve_min, p_adults, p_kids, p_snapshot);
  return v_slug;
end $$;

-- Owner: push the latest menu/date/guest counts.
create or replace function public.update_shared_event(
  p_slug text, p_edit_token text, p_title text, p_event_date date, p_serve_min int,
  p_adults int, p_kids int, p_snapshot jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update shared_events set title = p_title, event_date = p_event_date, serve_min = p_serve_min,
    adults = p_adults, kids = p_kids, snapshot = p_snapshot, updated_at = now()
  where slug = p_slug and edit_hash = _hash(p_edit_token);
  if not found then raise exception 'not allowed'; end if;
end $$;

-- Owner: stop sharing (also deletes every claim).
create or replace function public.delete_shared_event(p_slug text, p_edit_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from shared_events where slug = p_slug and edit_hash = _hash(p_edit_token);
  if not found then raise exception 'not allowed'; end if;
end $$;

-- Anyone with the link: read the event and who is bringing what. owner_key is never returned.
create or replace function public.get_shared_event(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', e.slug, 'mode', e.mode, 'title', e.title, 'event_date', e.event_date, 'serve_min', e.serve_min,
    'adults', e.adults, 'kids', e.kids, 'snapshot', e.snapshot, 'updated_at', e.updated_at,
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'dish_id', c.dish_id, 'name', c.name, 'what', c.what) order by c.created_at)
                        from claims c where c.event_id = e.id), '[]'::jsonb))
  from shared_events e where e.slug = p_slug
$$;

-- Guest: say "I'll bring this dish" (p_dish_id) or "I'll bring <p_what>" (p_dish_id null).
create or replace function public.claim_dish(
  p_slug text, p_dish_id text, p_what text, p_name text, p_owner_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare e shared_events; v_id uuid;
begin
  select * into e from shared_events where slug = p_slug;
  if not found then raise exception 'event not found'; end if;
  if (select count(*) from claims where event_id = e.id) >= 150 then raise exception 'too many claims'; end if;
  if p_dish_id is not null and not exists (
    select 1 from jsonb_array_elements(e.snapshot -> 'dishes') d where d ->> 'id' = p_dish_id
  ) then raise exception 'dish not on menu'; end if;
  begin
    insert into claims (event_id, dish_id, what, name, owner_key)
    values (e.id, p_dish_id, case when p_dish_id is null then btrim(p_what) end, btrim(p_name), p_owner_key)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already claimed';
  end;
  return v_id;
end $$;

-- Guest removes their own claim (using the key their browser kept), or the owner removes any claim.
create or replace function public.unclaim(
  p_slug text, p_claim_id uuid, p_owner_key text default null, p_edit_token text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare e shared_events;
begin
  select * into e from shared_events where slug = p_slug;
  if not found then raise exception 'event not found'; end if;
  delete from claims where id = p_claim_id and event_id = e.id
    and ((p_owner_key is not null and owner_key = p_owner_key)
      or (p_edit_token is not null and e.edit_hash = _hash(p_edit_token)));
  if not found then raise exception 'not allowed'; end if;
end $$;

revoke all on function public._hash(text) from public, anon, authenticated;
revoke all on function public.create_shared_event(text, text, text, date, int, int, int, jsonb) from public;
revoke all on function public.update_shared_event(text, text, text, date, int, int, int, jsonb) from public;
revoke all on function public.delete_shared_event(text, text) from public;
revoke all on function public.get_shared_event(text) from public;
revoke all on function public.claim_dish(text, text, text, text, text) from public;
revoke all on function public.unclaim(text, uuid, text, text) from public;
grant execute on function public.create_shared_event(text, text, text, date, int, int, int, jsonb) to anon, authenticated;
grant execute on function public.update_shared_event(text, text, text, date, int, int, int, jsonb) to anon, authenticated;
grant execute on function public.delete_shared_event(text, text) to anon, authenticated;
grant execute on function public.get_shared_event(text) to anon, authenticated;
grant execute on function public.claim_dish(text, text, text, text, text) to anon, authenticated;
grant execute on function public.unclaim(text, uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Accounts: each signed-in user gets one private row holding their whole Serves Twenty state, so their
-- menus, recipes, checklists and notes follow them across devices. Row level security means a
-- user can only ever read or write their own row (auth.uid() comes from their signed-in token).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (octet_length(data::text) < 2000000),
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
revoke all on public.user_data from anon, authenticated;
grant select, insert, update, delete on public.user_data to authenticated;

drop policy if exists "own row: read" on public.user_data;
drop policy if exists "own row: insert" on public.user_data;
drop policy if exists "own row: update" on public.user_data;
drop policy if exists "own row: delete" on public.user_data;
create policy "own row: read" on public.user_data for select to authenticated using (auth.uid() = user_id);
create policy "own row: insert" on public.user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "own row: update" on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.user_data for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- Delete my account: a signed-in user can erase their login and everything saved under it.
-- (user_data goes with it through the cascade above.) Shared menus are removed by the app first,
-- using each menu's edit token, because the database has no link between a user and a shared menu.
-- ---------------------------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Purchases: one row per account that has bought Serves 20 (website via Stripe; App Store later).
-- Signed-in users can only READ their own row. Only the server (the Stripe webhook, using the
-- service role) can add or remove rows, so nobody can unlock themselves.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null default 'stripe',
  ref text,                       -- Stripe payment_intent id, so a refund can find the row
  created_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;
drop policy if exists "own purchase: read" on public.entitlements;
create policy "own purchase: read" on public.entitlements for select to authenticated using (auth.uid() = user_id);
-- This project does not give the server role access to new tables by default; the Stripe webhook
-- (which runs as service_role) needs these to record and remove purchases.
grant select, insert, delete on public.entitlements to service_role;

-- ---------------------------------------------------------------------------------------------
-- Admin dashboard (serves20.com/#/admin) and the Support form.
-- Only people listed in public.admins can read the numbers; nobody else gets anything, even with the
-- page address. Support requests can be ADDED by anyone (rate limited) but only READ by admins.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
insert into public.admins (email) values ('vi@alevigroup.com') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 3 and 200),
  name text check (char_length(name) <= 100),
  message text not null check (char_length(message) between 5 and 4000),
  status text not null default 'open' check (status in ('open', 'done'))
);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;

create or replace function public.submit_support(p_email text, p_name text, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if char_length(trim(coalesce(p_message, ''))) < 5 then raise exception 'message too short'; end if;
  if (select count(*) from public.support_requests where created_at > now() - interval '1 hour') >= 100 then raise exception 'busy'; end if;
  if (select count(*) from public.support_requests where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour') >= 5 then raise exception 'too many'; end if;
  insert into public.support_requests (email, name, message)
  values (left(trim(p_email), 200), nullif(left(trim(coalesce(p_name, '')), 100), ''), left(trim(p_message), 4000));
end $$;
revoke all on function public.submit_support(text, text, text) from public;
grant execute on function public.submit_support(text, text, text) to anon, authenticated;


-- App Store downloads: filled daily by a script on the owner's Mac (tools/sync-app-store.mjs).
create table if not exists public.app_downloads (
  day date primary key,
  downloads int not null default 0,
  redownloads int not null default 0,
  updates int not null default 0,
  purchases int not null default 0
);
alter table public.app_downloads enable row level security;
revoke all on public.app_downloads from public, anon, authenticated;

create table if not exists public.ingest_keys (hash bytea primary key, note text);
alter table public.ingest_keys enable row level security;
revoke all on public.ingest_keys from public, anon, authenticated;

create or replace function public.ingest_downloads(p_token text, p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r jsonb;
begin
  if p_token is null or not exists (select 1 from public.ingest_keys where hash = sha256(convert_to(p_token, 'utf8'))) then
    raise exception 'not allowed';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.app_downloads(day, downloads, redownloads, updates, purchases)
    values ((r->>'day')::date, coalesce((r->>'downloads')::int,0), coalesce((r->>'redownloads')::int,0), coalesce((r->>'updates')::int,0), coalesce((r->>'purchases')::int,0))
    on conflict (day) do update set downloads = excluded.downloads, redownloads = excluded.redownloads, updates = excluded.updates, purchases = excluded.purchases;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.ingest_downloads(text, jsonb) from public;
grant execute on function public.ingest_downloads(text, jsonb) to anon, authenticated;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new_24h', (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'unlocked', (select count(*) from public.entitlements),
    'unlocked_by_source', coalesce((select jsonb_object_agg(source, c) from (select source, count(*) c from public.entitlements group by 1) s), '{}'::jsonb),
    'shared_menus', (select count(*) from public.shared_events),
    'claims', (select count(*) from public.claims),
    'web_sales', (select count(*) from public.entitlements where source = 'stripe'),
    'web_sales_7d', (select count(*) from public.entitlements where source = 'stripe' and created_at > now() - interval '7 days'),
    'downloads_total', (select coalesce(sum(downloads),0) from public.app_downloads),
    'downloads_7d', (select coalesce(sum(downloads),0) from public.app_downloads where day > current_date - 7),
    'purchases_total', (select coalesce(sum(purchases),0) from public.app_downloads),
    'downloads_synced_to', (select max(day) from public.app_downloads),
    'downloads_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', g::date, 'n', coalesce((select downloads from public.app_downloads a where a.day = g::date),0)) order by g)
      from generate_series(current_date - 29, current_date, interval '1 day') g), '[]'::jsonb),
    'support_open', (select count(*) from public.support_requests where status = 'open'),
    'signups_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d)
      from (select g::date as d, (select count(*) from auth.users u where u.created_at::date = g::date) as n
            from generate_series(current_date - 29, current_date, interval '1 day') g) t), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_people() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(row_to_json(t)) from (
    select u.email, u.created_at, u.last_sign_in_at, e.source as unlocked
    from auth.users u left join public.entitlements e on e.user_id = u.id
    order by u.created_at desc limit 300) t), '[]'::jsonb);
end $$;

create or replace function public.admin_support() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(row_to_json(t)) from (
    select id, created_at, email, name, message, status from public.support_requests order by created_at desc limit 300) t), '[]'::jsonb);
end $$;

create or replace function public.admin_support_set(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.support_requests set status = p_status where id = p_id;
end $$;

revoke all on function public.admin_overview(), public.admin_people(), public.admin_support(), public.admin_support_set(uuid, text) from public, anon;
grant execute on function public.admin_overview(), public.admin_people(), public.admin_support(), public.admin_support_set(uuid, text) to authenticated;
