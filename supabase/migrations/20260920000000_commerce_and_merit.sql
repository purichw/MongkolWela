-- Additive, private feature tables. Apply only after reviewing the release gates.
create table public.commerce_revision (
  singleton boolean primary key default true check (singleton),
  version bigint not null default 0
);
insert into public.commerce_revision(singleton) values(true);

create table public.commerce_organizations (
  id uuid primary key,
  document jsonb not null check (document->>'id' = id::text),
  updated_at timestamptz not null default now()
);

do $$
declare name text;
begin
  foreach name in array array['members','products','campaigns','channels','orders','bookings'] loop
    execute format('create table public.commerce_%I (
      id uuid primary key,
      org_id uuid not null references public.commerce_organizations(id),
      document jsonb not null check (document->>''id'' = id::text and document->>''orgId'' = org_id::text),
      updated_at timestamptz not null default now()
    )', name);
    execute format('create index on public.commerce_%I(org_id)', name);
  end loop;
end $$;

create unique index commerce_member_identity on public.commerce_members(org_id, (document->>'userId'));
create unique index commerce_product_sku on public.commerce_products(org_id, (document->>'sku'));
create index commerce_campaign_temple on public.commerce_campaigns((document->>'templeId'));
create index commerce_channel_temple on public.commerce_channels((document->>'templeId'));
create table public.commerce_audit (
  id bigint generated always as identity primary key,
  actor text not null,
  operation text not null,
  records jsonb not null,
  created_at timestamptz not null default now()
);

do $$
declare name text;
begin
  foreach name in array array['revision','organizations','members','products','campaigns','channels','orders','bookings','audit'] loop
    execute format('alter table public.commerce_%I enable row level security', name);
    execute format('revoke all on public.commerce_%I from anon, authenticated', name);
    execute format('grant select, insert, update on public.commerce_%I to service_role', name);
  end loop;
end $$;
grant usage, select on sequence public.commerce_audit_id_seq to service_role;
revoke update on public.commerce_audit from service_role;

-- Same public/financial whitelist as auditRecord in the trusted API.
create function public.commerce_audit_record(document jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select case when document is null then null else coalesce(jsonb_object_agg(key, value), '{}') end
  from jsonb_each(document)
  where key = any(array['id','orgId','version','updatedAt','status','templeId','templeIds','kind','userId','sku','priceSatang','stock','shippingSatang','totalSatang','capacity','amountSatang','channelId','url','sourceUrl','recipientId','recipientName','province','destinationKind','verifiedAt','closeDate','eventDate','quantity','campaignId','paymentStatus','donationReceived','receivedSatang','receivedAt','expiresAt']);
$$;

-- One statement gives a consistent snapshot. Public reads exclude customer and
-- membership fields even inside the service-to-database response.
create function public.commerce_snapshot(public_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb; name text; rows jsonb; count_rows bigint;
begin
  result := jsonb_build_object('revision', (select version from public.commerce_revision where singleton));
  foreach name in array array['organizations','members','products','campaigns','channels','orders','bookings'] loop
    execute format('select count(*) from public.commerce_%I', name) into count_rows;
    if count_rows > 5000 then raise exception 'Commerce paging upgrade required' using errcode='54000'; end if;
    if public_only and name = 'members' then rows := '[]'::jsonb;
    elsif public_only and name = 'orders' then
      select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',document->'status','lines',document->'lines','expiresAt',document->'expiresAt')), '[]') into rows from public.commerce_orders;
    elsif public_only and name = 'bookings' then
      select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',document->'status','campaignId',document->'campaignId','quantity',document->'quantity','expiresAt',document->'expiresAt')), '[]') into rows from public.commerce_bookings;
    else
      execute format('select coalesce(jsonb_agg(document order by updated_at desc), ''[]'') from public.commerce_%I', name) into rows;
    end if;
    result := result || jsonb_build_object(name, rows);
  end loop;
  return result;
end $$;

-- Business validation runs in the trusted API. The revision lock atomically
-- commits all rows or rejects stale snapshots; the API then revalidates/retries.
create function public.commerce_commit(expected_revision bigint, changes jsonb, actor_id text, operation_name text)
returns bigint language plpgsql security definer set search_path = public as $$
declare current_version bigint; change jsonb; name text; value jsonb; previous jsonb; records jsonb := '[]';
begin
  select version into current_version from public.commerce_revision where singleton for update;
  if current_version <> expected_revision then raise exception 'Commerce revision conflict' using errcode='40001'; end if;
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) > 50 then raise exception 'Invalid batch'; end if;
  for change in select * from jsonb_array_elements(changes) loop
    name := change->>'table'; value := change->'value';
    if name <> all(array['organizations','members','products','campaigns','channels','orders','bookings']) or name is null then raise exception 'Invalid table'; end if;
    execute format('select document from public.commerce_%I where id=$1', name) into previous using (value->>'id')::uuid;
    if name = 'organizations' then
      insert into public.commerce_organizations(id, document) values ((value->>'id')::uuid, value)
      on conflict(id) do update set document=excluded.document, updated_at=now();
    else
      execute format('insert into public.commerce_%I(id,org_id,document) values($1,$2,$3)
        on conflict(id) do update set document=excluded.document, updated_at=now()', name)
        using (value->>'id')::uuid, (value->>'orgId')::uuid, value;
    end if;
    records := records || jsonb_build_array(jsonb_build_object('table',name,'id',value->>'id','before',public.commerce_audit_record(previous),'after',public.commerce_audit_record(value)));
  end loop;
  update public.commerce_revision set version=version+1 where singleton returning version into current_version;
  insert into public.commerce_audit(actor,operation,records) values(actor_id,operation_name,records);
  return current_version;
end $$;

revoke all on function public.commerce_snapshot(boolean) from public, anon, authenticated;
revoke all on function public.commerce_audit_record(jsonb) from public, anon, authenticated;
revoke all on function public.commerce_commit(bigint,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.commerce_snapshot(boolean) to service_role;
grant execute on function public.commerce_audit_record(jsonb) to service_role;
grant execute on function public.commerce_commit(bigint,jsonb,text,text) to service_role;
