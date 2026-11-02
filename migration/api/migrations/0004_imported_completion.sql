CREATE TABLE imported_completion (
  account_id TEXT NOT NULL REFERENCES backup_trial_snapshots(account_id),
  task_id TEXT NOT NULL,
  done INTEGER NOT NULL CHECK (done IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision > 0),
  PRIMARY KEY (account_id, task_id)
);
