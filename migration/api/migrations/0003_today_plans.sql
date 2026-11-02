-- Editable personal plans belong to the account that owns the restore point.
CREATE TABLE today_plans (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES backup_trial_snapshots(account_id),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  tasks TEXT NOT NULL CHECK (json_valid(tasks))
);
