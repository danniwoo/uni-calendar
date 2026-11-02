-- Independent synthetic-data proof only. Never apply to the Sites DB.
CREATE TABLE pilot_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE pilot_identities (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (issuer, subject)
);
CREATE INDEX pilot_identities_account ON pilot_identities(account_id);
CREATE TABLE pilot_boards (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK (json_valid(data)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TEXT NOT NULL
);
