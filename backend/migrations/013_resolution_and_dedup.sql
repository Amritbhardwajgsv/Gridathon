-- Migration 013: resolution feedback fields + deduplication pointer
-- Run in Supabase SQL Editor

-- Resolution fields: captured by officer when marking resolved
alter table citizen_grievances
    add column if not exists resolved_at              timestamptz,
    add column if not exists actual_duration_min      int,
    add column if not exists actual_personnel_deployed int,
    add column if not exists resolution_notes         text,
    add column if not exists confirmed_cause          text,

-- Deduplication: points to the original tracking_id if this is a duplicate
    add column if not exists duplicate_of             text;

-- Index for fast dedup lookups (location + time window)
create index if not exists idx_grievances_location_time
    on citizen_grievances (latitude, longitude, created_at)
    where status not in ('rejected', 'resolved', 'closed');

-- Index for reporter_email (status update emails)
create index if not exists idx_grievances_reporter_email
    on citizen_grievances (reporter_email)
    where reporter_email is not null;
