create extension if not exists pgcrypto;

alter table app_users
    add column if not exists approval_status text not null default 'approved' check (
        approval_status in ('pending', 'approved', 'rejected')
    ),
    add column if not exists approved_by_user_id uuid references app_users(id),
    add column if not exists approved_at timestamptz,
    add column if not exists badge_id text,
    add column if not exists rank text,
    add column if not exists unit_name text;

update app_users
set approval_status = 'approved',
    is_active = true
where approval_status is null
   or approval_status = 'pending';

create unique index if not exists idx_app_users_badge_id_unique
    on app_users (lower(badge_id))
    where badge_id is not null;

create table if not exists police_personnel (
    id uuid primary key default gen_random_uuid(),
    badge_id text not null unique,
    name text not null,
    rank text not null check (
        rank in ('Constable', 'Head Constable', 'ASI', 'SI', 'Inspector', 'ACP', 'DCP')
    ),
    unit_name text not null,
    zone text,
    phone text,
    is_available boolean not null default true,
    created_by_user_id uuid references app_users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_police_personnel_rank_available
    on police_personnel (rank, is_available);

create table if not exists deployment_orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique,
    grievance_id uuid references citizen_grievances(id),
    prediction_event_id uuid references prediction_events(id),
    commander_user_id uuid references app_users(id),
    corridor text not null,
    zone text not null,
    priority text not null,
    status text not null default 'draft' check (
        status in ('draft', 'issued', 'in_progress', 'completed', 'cancelled')
    ),
    resource_recommendation jsonb not null default '{}'::jsonb,
    field_brief text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists deployment_order_personnel (
    deployment_order_id uuid not null references deployment_orders(id) on delete cascade,
    personnel_id uuid not null references police_personnel(id),
    assignment_role text not null default 'field deployment',
    primary key (deployment_order_id, personnel_id)
);

create index if not exists idx_deployment_orders_status
    on deployment_orders (status, created_at desc);

create or replace function set_police_personnel_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_police_personnel_updated_at on police_personnel;

create trigger trg_police_personnel_updated_at
before update on police_personnel
for each row
execute function set_police_personnel_updated_at();

create or replace function set_deployment_orders_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_deployment_orders_updated_at on deployment_orders;

create trigger trg_deployment_orders_updated_at
before update on deployment_orders
for each row
execute function set_deployment_orders_updated_at();
