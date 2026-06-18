create extension if not exists pgcrypto;

create table if not exists app_users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    role text not null check (role in ('admin', 'operator', 'viewer')),
    password_hash text not null,
    is_active boolean not null default true,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_email
    on app_users (lower(email));

create index if not exists idx_app_users_role
    on app_users (role);

alter table prediction_events
    add column if not exists created_by_user_id uuid references app_users(id);

create index if not exists idx_prediction_events_created_by_user_id
    on prediction_events (created_by_user_id);

create or replace function set_app_users_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_users_updated_at on app_users;

create trigger trg_app_users_updated_at
before update on app_users
for each row
execute function set_app_users_updated_at();
