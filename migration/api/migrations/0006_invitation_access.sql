-- Stage 1: private invitation enrolment. Existing backup-trial members retain access.
CREATE TABLE access_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL DEFAULT 'private' CHECK(kind IN ('private','campaign','friend_referral')),
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
  label TEXT,
  max_redemptions INTEGER NOT NULL DEFAULT 1 CHECK(max_redemptions > 0),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK(redemption_count >= 0 AND redemption_count <= max_redemptions),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_claim_id TEXT
);
CREATE INDEX access_invitations_state ON access_invitations(kind,revoked_at,expires_at);

CREATE TABLE account_access (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK(state IN ('active','suspended','deletion_pending','deleted')),
  source TEXT NOT NULL CHECK(source IN ('legacy_pilot','private_invitation','campaign','friend_referral')),
  invitation_id TEXT REFERENCES access_invitations(id),
  enrolled_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX account_access_state ON account_access(state,updated_at);

CREATE TABLE invitation_redemptions (
  invitation_id TEXT NOT NULL REFERENCES access_invitations(id),
  account_id TEXT NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL UNIQUE,
  counted INTEGER NOT NULL DEFAULT 0 CHECK(counted IN (0,1)),
  redeemed_at TEXT NOT NULL,
  PRIMARY KEY(invitation_id,account_id),
  UNIQUE(account_id)
);
CREATE INDEX invitation_redemptions_account ON invitation_redemptions(account_id);

-- The old allowlist is also the storage parent for imported snapshots. Preserve
-- every current pilot member while moving authorization to account_access.
INSERT INTO account_access(account_id,state,source,invitation_id,enrolled_at,updated_at)
SELECT account_id,'active','legacy_pilot',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM backup_trial_members
WHERE 1
ON CONFLICT(account_id) DO NOTHING;
