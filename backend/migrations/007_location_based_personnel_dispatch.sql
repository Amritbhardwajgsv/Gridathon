alter table police_personnel
    add column if not exists current_latitude double precision,
    add column if not exists current_longitude double precision,
    add column if not exists whatsapp_phone text,
    add column if not exists last_location_at timestamptz;

alter table deployment_orders
    add column if not exists notification_payload jsonb not null default '{}'::jsonb,
    add column if not exists deployment_latitude double precision,
    add column if not exists deployment_longitude double precision;

create index if not exists idx_police_personnel_location_available
    on police_personnel (is_available, current_latitude, current_longitude);
