-- Keep the initial restore point immutable. Only the active imported semester changes.
CREATE TABLE recovery_active (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES backup_trial_snapshots(account_id),
  sha256 TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), imported_at TEXT NOT NULL
);
CREATE TABLE recovery_versions (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES backup_trial_members(account_id),
  version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0)
);
CREATE TRIGGER recovery_version_step BEFORE UPDATE OF version ON recovery_versions
WHEN NEW.version != OLD.version + 1
BEGIN SELECT RAISE(ABORT, 'recovery_preview_stale'); END;
ALTER TABLE imported_completion ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
CREATE TRIGGER recovery_clock_backup_trial_snapshots_insert AFTER INSERT ON backup_trial_snapshots
BEGIN
  INSERT INTO recovery_versions(account_id,version) VALUES (NEW.account_id,1)
  ON CONFLICT(account_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER recovery_clock_today_plans_insert AFTER INSERT ON today_plans
BEGIN
  INSERT INTO recovery_versions(account_id,version) VALUES (NEW.account_id,1)
  ON CONFLICT(account_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER recovery_clock_today_plans_update AFTER UPDATE ON today_plans
BEGIN
  INSERT INTO recovery_versions(account_id,version) VALUES (NEW.account_id,1)
  ON CONFLICT(account_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER recovery_clock_today_plans_delete AFTER DELETE ON today_plans
BEGIN
  INSERT INTO recovery_versions(account_id,version) VALUES (OLD.account_id,1)
  ON CONFLICT(account_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER recovery_clock_imported_completion_insert AFTER INSERT ON imported_completion
BEGIN
  INSERT INTO recovery_versions(account_id,version) VALUES (NEW.account_id,1)
  ON CONFLICT(account_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER recovery_clock_imported_completion_update AFTER UPDATE ON imported_completion
BEGIN
  INSERT INTO recovery_versions(account_id,version) VALUES (NEW.account_id,1)
  ON CONFLICT(account_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER recovery_clock_imported_completion_delete AFTER DELETE ON imported_completion
BEGIN
  INSERT INTO recovery_versions(account_id,version) VALUES (OLD.account_id,1)
  ON CONFLICT(account_id) DO UPDATE SET version=version+1;
END;
