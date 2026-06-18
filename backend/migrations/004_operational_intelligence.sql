create extension if not exists pgcrypto;

alter table citizen_grievances
    add column if not exists geocoding_provider text,
    add column if not exists geocoding_confidence numeric(4, 3),
    add column if not exists geocoding_raw jsonb,
    add column if not exists agent_priority_score integer check (
        agent_priority_score is null
        or (agent_priority_score >= 0 and agent_priority_score <= 100)
    ),
    add column if not exists agent_recommendation text;

create table if not exists agent_actions (
    id uuid primary key default gen_random_uuid(),
    aggregate_type text not null,
    aggregate_id uuid not null,
    agent_name text not null,
    action_type text not null,
    recommendation text not null,
    confidence numeric(4, 3),
    status text not null default 'proposed' check (
        status in ('proposed', 'accepted', 'overridden', 'dismissed')
    ),
    created_at timestamptz not null default now()
);

create index if not exists idx_agent_actions_aggregate
    on agent_actions (aggregate_type, aggregate_id, created_at desc);

create table if not exists event_stream_outbox (
    id uuid primary key default gen_random_uuid(),
    topic text not null,
    event_key text not null,
    event_payload jsonb not null,
    publish_status text not null default 'pending' check (
        publish_status in ('pending', 'published', 'failed')
    ),
    attempts integer not null default 0,
    created_at timestamptz not null default now(),
    published_at timestamptz
);

create index if not exists idx_event_stream_outbox_pending
    on event_stream_outbox (publish_status, created_at)
    where publish_status = 'pending';

create table if not exists retraining_runs (
    id uuid primary key default gen_random_uuid(),
    run_type text not null default 'weekly',
    status text not null default 'queued' check (
        status in ('queued', 'running', 'succeeded', 'failed')
    ),
    source_rows integer,
    retraining_rows integer,
    duration_mae double precision,
    duration_r2 double precision,
    classifier_accuracy double precision,
    artifact_path text,
    error_message text,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists model_registry (
    id uuid primary key default gen_random_uuid(),
    model_name text not null,
    model_version text not null,
    artifact_path text not null,
    metrics jsonb not null default '{}'::jsonb,
    is_active boolean not null default false,
    retraining_run_id uuid references retraining_runs(id),
    created_at timestamptz not null default now(),
    constraint uq_model_registry_name_version unique (model_name, model_version)
);

create index if not exists idx_model_registry_active
    on model_registry (model_name, is_active);
