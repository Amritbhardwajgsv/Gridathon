-- Migration 014: photo URL for citizen incident reports
alter table citizen_grievances
    add column if not exists photo_url text;
