alter table citizen_grievances
    drop constraint if exists citizen_grievances_status_check;

alter table citizen_grievances
    add constraint citizen_grievances_status_check check (
        status in (
            'evaluating',
            'submitted', 'triaged', 'linked_to_prediction', 'dispatched',
            'pending', 'in_progress', 'assigned', 'pending_verification',
            'resolved', 'closed', 'rejected'
        )
    );
