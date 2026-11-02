-- Staging only. Admission is granted by the operator to an already verified account.
CREATE TABLE backup_trial_members (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pilot_accounts(id)
);
-- One immutable restore point per admitted account. The sample board remains separate.
CREATE TABLE backup_trial_snapshots (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES backup_trial_members(account_id),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  data TEXT NOT NULL CHECK (json_valid(data)),
  imported_at TEXT NOT NULL
);
