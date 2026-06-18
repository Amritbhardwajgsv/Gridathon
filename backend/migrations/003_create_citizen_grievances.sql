create extension if not exists pgcrypto;

create table if not exists citizen_grievances (
    id uuid primary key default gen_random_uuid(),
    tracking_id text not null unique,

    reporter_name text,
    reporter_phone text,
    reporter_email text,

    complaint_type text not null check (
        complaint_type in (
            'event_congestion',
            'illegal_parking',
            'road_closure',
            'accident_or_breakdown',
            'signal_failure',
            'other'
        )
    ),
    severity text not null check (severity in ('Low', 'Medium', 'High', 'Critical')),
    location_text text not null,
    zone text,
    corridor text,
    latitude double precision,
    longitude double precision,
    description text not null,

    status text not null default 'submitted' check (
        status in (
            'submitted',
            'triaged',
            'linked_to_prediction',
            'dispatched',
            'resolved',
            'rejected'
        )
    ),
    source text not null default 'citizen_portal',
    linked_prediction_event_id uuid references prediction_events(id),
    assigned_to_user_id uuid references app_users(id),
    police_notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_citizen_grievances_created_at
    on citizen_grievances (created_at desc);

create index if not exists idx_citizen_grievances_status
    on citizen_grievances (status, created_at desc);

create index if not exists idx_citizen_grievances_zone_corridor
    on citizen_grievances (zone, corridor);

create or replace function set_citizen_grievances_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_citizen_grievances_updated_at on citizen_grievances;

create trigger trg_citizen_grievances_updated_at
before update on citizen_grievances
for each row
execute function set_citizen_grievances_updated_at();

create or replace function log_citizen_grievance_change()
returns trigger as $$
begin
    if tg_op = 'INSERT' then
        insert into drishti_event_log (
            aggregate_type,
            aggregate_key,
            event_type,
            event_payload
        )
        values (
            'citizen_grievances',
            new.tracking_id,
            'citizen_grievance_submitted',
            to_jsonb(new)
        );
        return new;
    end if;

    if tg_op = 'UPDATE' then
        insert into drishti_event_log (
            aggregate_type,
            aggregate_key,
            event_type,
            event_payload
        )
        values (
            'citizen_grievances',
            new.tracking_id,
            'citizen_grievance_updated',
            jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
        );
        return new;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_citizen_grievance_change_log on citizen_grievances;

create trigger trg_citizen_grievance_change_log
after insert or update on citizen_grievances
for each row
execute function log_citizen_grievance_change();
