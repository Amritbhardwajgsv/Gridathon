create index if not exists idx_police_personnel_badge_active
    on police_personnel (lower(badge_id), is_active);

create index if not exists idx_police_personnel_last_location
    on police_personnel (last_location_at desc)
    where is_active = true;
