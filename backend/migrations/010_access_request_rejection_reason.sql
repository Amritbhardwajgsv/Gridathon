alter table app_users
    add column if not exists rejection_reason text;

