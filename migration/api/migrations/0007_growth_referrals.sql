-- Stage 2: society campaigns, combined friend-referral enrolment and Friends.
-- Academic access, acquisition attribution and friendship remain separate.
CREATE TABLE growth_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'society' CHECK(channel IN ('society')),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

-- One access token can carry either a campaign or an inviter. Keeping this in
-- a separate table leaves the Stage 1 invitation table append-only compatible.
CREATE TABLE invitation_contexts (
  invitation_id TEXT PRIMARY KEY NOT NULL REFERENCES access_invitations(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES growth_campaigns(id),
  inviter_account_id TEXT REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  CHECK((campaign_id IS NOT NULL) != (inviter_account_id IS NOT NULL))
);
CREATE INDEX invitation_context_inviter ON invitation_contexts(inviter_account_id)
  WHERE inviter_account_id IS NOT NULL;

-- Immutable first-touch acquisition. root_campaign_id is lineage, while
-- direct_channel records how this account itself enrolled.
CREATE TABLE account_attribution (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  direct_channel TEXT NOT NULL CHECK(direct_channel IN ('legacy_pilot','private_invitation','society','friend_referral')),
  campaign_id TEXT REFERENCES growth_campaigns(id),
  referrer_account_id TEXT REFERENCES pilot_accounts(id),
  root_campaign_id TEXT REFERENCES growth_campaigns(id),
  acquired_at TEXT NOT NULL,
  CHECK((direct_channel='society' AND campaign_id IS NOT NULL AND referrer_account_id IS NULL)
     OR (direct_channel='friend_referral' AND campaign_id IS NULL AND referrer_account_id IS NOT NULL)
     OR (direct_channel IN ('legacy_pilot','private_invitation') AND campaign_id IS NULL AND referrer_account_id IS NULL)),
  CHECK(referrer_account_id IS NULL OR referrer_account_id != account_id)
);
CREATE INDEX account_attribution_referrer ON account_attribution(referrer_account_id);
CREATE INDEX account_attribution_root ON account_attribution(root_campaign_id,direct_channel);

CREATE TABLE friend_profiles (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 60),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE friendships (
  id TEXT PRIMARY KEY NOT NULL,
  account_a TEXT NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  account_b TEXT NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  requester_account_id TEXT NOT NULL REFERENCES pilot_accounts(id),
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','blocked')),
  blocked_by_account_id TEXT REFERENCES pilot_accounts(id),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(account_a < account_b),
  CHECK(requester_account_id IN (account_a,account_b)),
  CHECK(blocked_by_account_id IS NULL OR blocked_by_account_id IN (account_a,account_b)),
  UNIQUE(account_a,account_b)
);
CREATE INDEX friendships_a_status ON friendships(account_a,status,updated_at);
CREATE INDEX friendships_b_status ON friendships(account_b,status,updated_at);

-- Friendship request limits are intentionally independent of invitation
-- redemption capacity.
CREATE TABLE friend_rate_limits (
  account_id TEXT NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK(count > 0),
  PRIMARY KEY(account_id,action)
);

-- Preserve attribution for every Stage 1 account without changing access.
INSERT INTO account_attribution(account_id,direct_channel,acquired_at)
SELECT account_id,
  CASE source WHEN 'private_invitation' THEN 'private_invitation' ELSE 'legacy_pilot' END,
  enrolled_at
FROM account_access
WHERE 1
ON CONFLICT(account_id) DO NOTHING;
