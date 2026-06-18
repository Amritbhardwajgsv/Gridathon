alter table prediction_events
    add column if not exists nlp_signal jsonb,
    add column if not exists resource_recommendation jsonb,
    add column if not exists learning_signal jsonb,
    add column if not exists event_name text,
    add column if not exists estimated_crowd_size integer,
    add column if not exists operational_description text;
