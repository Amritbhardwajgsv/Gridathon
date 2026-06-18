create extension if not exists pgcrypto;

create table if not exists drishti_event_log (
    id uuid primary key default gen_random_uuid(),
    aggregate_type text not null,
    aggregate_key text not null,
    event_type text not null,
    event_payload jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_drishti_event_log_aggregate
    on drishti_event_log (aggregate_type, aggregate_key, created_at);

create table if not exists prediction_events (
    id uuid primary key default gen_random_uuid(),
    idempotency_key text not null unique,
    pipeline_mode text not null check (pipeline_mode in ('planned', 'unplanned')),

    event_cause_grouped text not null,
    event_type text not null,
    priority text not null,
    requires_road_closure boolean not null,
    corridor text not null,
    zone text not null,
    latitude double precision not null,
    longitude double precision not null,
    hour integer not null check (hour between 0 and 23),
    day_of_week integer not null check (day_of_week between 0 and 6),
    month integer not null check (month between 1 and 12),

    predicted_duration_minutes numeric(10, 2) not null,
    impact_level text not null check (
        impact_level in ('Low', 'Medium', 'High', 'Critical')
    ),
    model_version text not null default 'v1',

    request_payload jsonb not null,
    response_payload jsonb not null,
    source text not null default 'frontend_operator',

    diversion_compliance_rate numeric(4, 3) check (
        diversion_compliance_rate is null
        or (diversion_compliance_rate >= 0 and diversion_compliance_rate <= 1)
    ),
    recommendation_policy text not null default 'compliance_weighted',

    operator_override_notes text,
    override_recorded_at timestamptz,

    actual_duration_minutes numeric(10, 2),
    actual_impact_level text check (
        actual_impact_level is null
        or actual_impact_level in ('Low', 'Medium', 'High', 'Critical')
    ),
    actual_resolution_notes text,
    resolved_at timestamptz,

    feedback_diversion_worked boolean,
    feedback_personnel_adequate boolean,
    feedback_dispersal_slower_than_predicted boolean,
    compliance_delta_meters numeric(10, 2),
    resolution_drift_minutes numeric(10, 2),

    eligible_for_retraining boolean generated always as (
        actual_duration_minutes is not null
        or actual_impact_level is not null
        or feedback_diversion_worked is not null
        or feedback_personnel_adequate is not null
        or feedback_dispersal_slower_than_predicted is not null
        or compliance_delta_meters is not null
        or resolution_drift_minutes is not null
    ) stored,
    used_for_retraining boolean not null default false,
    retraining_batch_id uuid,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists event_conflict_escalations (
    id uuid primary key default gen_random_uuid(),
    primary_prediction_event_id uuid not null references prediction_events(id),
    conflicting_prediction_event_id uuid not null references prediction_events(id),
    conflict_type text not null default 'overlapping_junction_or_corridor',
    junction_or_corridor text not null,
    escalation_status text not null default 'requires_dcp_review' check (
        escalation_status in (
            'requires_dcp_review',
            'acknowledged',
            'resolved'
        )
    ),
    escalation_notes text,
    created_at timestamptz not null default now(),
    resolved_at timestamptz,
    constraint uq_event_conflict_pair unique (
        primary_prediction_event_id,
        conflicting_prediction_event_id,
        junction_or_corridor
    )
);

create table if not exists event_pii_vault (
    id uuid primary key default gen_random_uuid(),
    prediction_event_id uuid references prediction_events(id) on delete cascade,
    pii_type text not null check (
        pii_type in (
            'vehicle_number',
            'citizen_id',
            'phone_number',
            'officer_identifier',
            'other'
        )
    ),
    pii_payload jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_prediction_events_created_at
    on prediction_events (created_at desc);

create index if not exists idx_prediction_events_idempotency_key
    on prediction_events (idempotency_key);

create index if not exists idx_prediction_events_pipeline_mode
    on prediction_events (pipeline_mode);

create index if not exists idx_prediction_events_zone_corridor
    on prediction_events (zone, corridor);

create index if not exists idx_prediction_events_impact_level
    on prediction_events (impact_level);

create index if not exists idx_prediction_events_retraining_queue
    on prediction_events (eligible_for_retraining, used_for_retraining)
    where eligible_for_retraining = true and used_for_retraining = false;

create index if not exists idx_event_conflict_escalations_status
    on event_conflict_escalations (escalation_status, created_at);

create or replace function set_prediction_events_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prediction_events_updated_at on prediction_events;

create trigger trg_prediction_events_updated_at
before update on prediction_events
for each row
execute function set_prediction_events_updated_at();

create or replace function log_prediction_events_change()
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
            'prediction_events',
            new.idempotency_key,
            'prediction_created',
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
            'prediction_events',
            new.idempotency_key,
            'prediction_updated',
            jsonb_build_object(
                'before', to_jsonb(old),
                'after', to_jsonb(new)
            )
        );
        return new;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prediction_events_change_log on prediction_events;

create trigger trg_prediction_events_change_log
after insert or update on prediction_events
for each row
execute function log_prediction_events_change();

create or replace view retraining_prediction_dataset as
select
    id,
    event_cause_grouped,
    event_type,
    priority,
    requires_road_closure,
    corridor,
    zone,
    latitude,
    longitude,
    hour,
    day_of_week,
    month,
    pipeline_mode,
    predicted_duration_minutes,
    impact_level as predicted_impact_level,
    diversion_compliance_rate,
    actual_duration_minutes,
    actual_impact_level,
    feedback_diversion_worked,
    feedback_personnel_adequate,
    feedback_dispersal_slower_than_predicted,
    compliance_delta_meters,
    resolution_drift_minutes,
    model_version,
    created_at
from prediction_events
where eligible_for_retraining = true
  and used_for_retraining = false;
