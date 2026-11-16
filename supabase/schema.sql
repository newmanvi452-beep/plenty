-- Plenty: shared menus with guest dish claims.
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
-- Accounts: each signed-in user gets one private row holding their whole Plenty state, so their
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
