begin;

create table if not exists public.admin_portal_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_portal_members enable row level security;
revoke all on table public.admin_portal_members from public, anon, authenticated, service_role;
grant select on table public.admin_portal_members to service_role;

-- Membership is provisioned separately in the Dashboard, never from shipped IDs.
commit;
