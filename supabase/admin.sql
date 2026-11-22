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
