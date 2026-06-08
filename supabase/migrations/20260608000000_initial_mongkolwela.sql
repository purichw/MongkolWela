-- Mongkol Wela production data foundation.
-- Apply this in Supabase SQL editor or with `supabase db push` after linking the
-- project. Public reads are limited to published/live data; writes are reserved
-- for the Supabase service role used by server-side admin APIs.

create extension if not exists pgcrypto;

create table if not exists public.cms_documents (
  id text primary key default 'live',
  content jsonb not null,
  schema_version integer not null default 1,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  published_by text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.cms_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references public.cms_documents(id) on delete cascade,
  content jsonb not null,
  schema_version integer not null default 1,
  actor text,
  source text not null default 'admin',
  commit_sha text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor text,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  page_path text,
  page_title text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create table if not exists public.temple_collections (
  key text primary key,
  label_th text not null,
  description_th text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.temple_places (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  name_th text not null,
  slug text,
  place_type text,
  region text,
  province text,
  district text,
  subdistrict text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  plus_code text,
  coordinate_status text,
  coordinate_confidence text,
  coordinate_source text,
  coordinate_address text,
  blessings text[] not null default '{}',
  object_heroes text[] not null default '{}',
  object_hero_types text[] not null default '{}',
  category_membership text[] not null default '{}',
  travel_modes text[] not null default '{}',
  image_url text,
  image_alt text,
  image_source_label text,
  image_source_url text,
  image_match_score integer,
  admin_editable boolean not null default true,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.temple_collection_entries (
  collection_key text not null references public.temple_collections(key) on delete cascade,
  place_id uuid not null references public.temple_places(id) on delete cascade,
  rank integer,
  category_rank integer,
  mentions integer,
  category_mentions integer,
  global_rank integer,
  global_mentions integer,
  global_source_count integer,
  route_names text[] not null default '{}',
  tour_companies text[] not null default '{}',
  source_keys text[] not null default '{}',
  source_types text[] not null default '{}',
  raw_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection_key, place_id)
);

create table if not exists public.temple_sources (
  source_key text primary key,
  source_type text,
  title text,
  url text,
  publisher text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.temple_source_mentions (
  source_key text not null references public.temple_sources(source_key) on delete cascade,
  place_id uuid not null references public.temple_places(id) on delete cascade,
  collection_key text references public.temple_collections(key) on delete cascade,
  mention_count integer not null default 1,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (source_key, place_id, collection_key)
);

create table if not exists public.temple_routes (
  id uuid primary key default gen_random_uuid(),
  route_key text unique,
  name_th text not null,
  collection_key text references public.temple_collections(key) on delete set null,
  province text,
  region text,
  travel_modes text[] not null default '{}',
  tour_company text,
  package_name text,
  source_key text references public.temple_sources(source_key) on delete set null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.temple_route_stops (
  route_id uuid not null references public.temple_routes(id) on delete cascade,
  place_id uuid not null references public.temple_places(id) on delete cascade,
  stop_order integer not null,
  note text,
  raw_data jsonb not null default '{}'::jsonb,
  primary key (route_id, place_id, stop_order)
);

create index if not exists cms_revisions_document_created_idx on public.cms_revisions (document_id, created_at desc);
create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_path_created_idx on public.analytics_events (page_path, created_at desc);
create index if not exists temple_places_location_idx on public.temple_places (latitude, longitude);
create index if not exists temple_places_province_idx on public.temple_places (province, district);
create index if not exists temple_entries_rank_idx on public.temple_collection_entries (collection_key, rank);
create index if not exists temple_mentions_place_idx on public.temple_source_mentions (place_id);

alter table public.cms_documents enable row level security;
alter table public.cms_revisions enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.analytics_events enable row level security;
alter table public.temple_collections enable row level security;
alter table public.temple_places enable row level security;
alter table public.temple_collection_entries enable row level security;
alter table public.temple_sources enable row level security;
alter table public.temple_source_mentions enable row level security;
alter table public.temple_routes enable row level security;
alter table public.temple_route_stops enable row level security;

drop policy if exists "Public can read live cms document" on public.cms_documents;
create policy "Public can read live cms document"
  on public.cms_documents for select
  using (id = 'live' and status = 'published');

drop policy if exists "Public can read active temple collections" on public.temple_collections;
create policy "Public can read active temple collections"
  on public.temple_collections for select
  using (is_active = true);

drop policy if exists "Public can read temple places" on public.temple_places;
create policy "Public can read temple places"
  on public.temple_places for select
  using (true);

drop policy if exists "Public can read temple collection entries" on public.temple_collection_entries;
create policy "Public can read temple collection entries"
  on public.temple_collection_entries for select
  using (true);

drop policy if exists "Public can read temple sources" on public.temple_sources;
create policy "Public can read temple sources"
  on public.temple_sources for select
  using (true);

drop policy if exists "Public can read temple source mentions" on public.temple_source_mentions;
create policy "Public can read temple source mentions"
  on public.temple_source_mentions for select
  using (true);

drop policy if exists "Public can read temple routes" on public.temple_routes;
create policy "Public can read temple routes"
  on public.temple_routes for select
  using (true);

drop policy if exists "Public can read temple route stops" on public.temple_route_stops;
create policy "Public can read temple route stops"
  on public.temple_route_stops for select
  using (true);

insert into public.temple_collections (key, label_th, description_th, sort_order)
values
  ('popular', 'สายไหว้พระ 9 วัด', 'เส้นทางและวัดยอดนิยมสำหรับไหว้พระ 9 วัด', 10),
  ('mu', 'สายมู', 'สถานที่ขอพร สายมู และสิ่งศักดิ์สิทธิ์ที่คัดกรองแล้ว', 20),
  ('sacred', 'วัดศักดิ์สิทธิ์', 'วัดและสถานที่ศักดิ์สิทธิ์เด่นทั่วไทย', 30)
on conflict (key) do update set
  label_th = excluded.label_th,
  description_th = excluded.description_th,
  sort_order = excluded.sort_order,
  updated_at = now();
