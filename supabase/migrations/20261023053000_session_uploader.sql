-- A session has no pull request author. The member who uploaded it is the contributor.
alter table normalized_events add column uploaded_by uuid;
