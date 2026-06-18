alter table police_personnel
    add column if not exists is_active boolean not null default true;

create index if not exists idx_police_personnel_active_available
    on police_personnel (is_active, is_available);
