alter table citizen_grievances
    add column if not exists nlp_event_cause text,
    add column if not exists nlp_vehicle_type text,
    add column if not exists nlp_event_type text not null default 'unplanned',
    add column if not exists nlp_priority text,
    add column if not exists nlp_requires_road_closure boolean,
    add column if not exists nlp_extracted_at timestamptz,
    add column if not exists used_for_retraining boolean not null default false,
    add column if not exists retraining_batch_id uuid;

alter table citizen_grievances
    drop constraint if exists citizen_grievances_status_check;

alter table citizen_grievances
    add constraint citizen_grievances_status_check check (
        status in (
            'submitted', 'triaged', 'linked_to_prediction', 'dispatched',
            'pending', 'in_progress', 'assigned', 'pending_verification',
            'resolved', 'closed', 'rejected'
        )
    );

create index if not exists idx_grievance_retraining_queue
    on citizen_grievances (used_for_retraining, updated_at)
    where used_for_retraining = false
      and nlp_extracted_at is not null;

create or replace view grievance_retraining_dataset as
select
    id as source_id,
    coalesce(nlp_event_cause, 'others') as event_cause_grouped,
    coalesce(nlp_event_type, 'unplanned') as event_type,
    coalesce(nlp_priority, 'Low') as priority,
    coalesce(nlp_requires_road_closure, false) as requires_road_closure,
    coalesce(corridor, 'Non-corridor') as corridor,
    coalesce(zone, 'unknown') as zone,
    latitude,
    longitude,
    extract(hour from created_at)::integer as hour,
    extract(dow from created_at)::integer as day_of_week,
    extract(month from created_at)::integer as month,
    greatest(extract(epoch from (updated_at - created_at)) / 60.0, 0) as duration_minutes,
    severity as impact_level
from citizen_grievances
where status in ('resolved', 'closed')
  and nlp_extracted_at is not null
  and used_for_retraining = false
  and latitude is not null
  and longitude is not null;
