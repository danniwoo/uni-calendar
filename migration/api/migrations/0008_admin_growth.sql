-- Stage 3: D1-backed administrators, versioned growth policy, audit trail and
-- campaign distribution metadata. No academic records are exposed here.
CREATE TABLE admin_roles (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin')),
  granted_by_account_id TEXT REFERENCES pilot_accounts(id),
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX admin_roles_active ON admin_roles(role,revoked_at);

CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  admin_account_id TEXT REFERENCES pilot_accounts(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  before_json TEXT,
  after_json TEXT,
  result TEXT NOT NULL CHECK(result IN ('success','failure')),
  created_at TEXT NOT NULL
);
CREATE INDEX admin_audit_recent ON admin_audit_log(created_at DESC);
CREATE INDEX admin_audit_target ON admin_audit_log(target_type,target_id,created_at DESC);
CREATE TRIGGER admin_audit_no_update BEFORE UPDATE ON admin_audit_log BEGIN
  SELECT RAISE(ABORT,'admin audit log is append-only');
END;
CREATE TRIGGER admin_audit_no_delete BEFORE DELETE ON admin_audit_log BEGIN
  SELECT RAISE(ABORT,'admin audit log is append-only');
END;

CREATE TABLE growth_policy_versions (
  version INTEGER PRIMARY KEY NOT NULL CHECK(version > 0),
  stage TEXT NOT NULL CHECK(stage IN ('private_pilot','campus_beta','campus_launch','public_access')),
  policy_json TEXT NOT NULL CHECK(json_valid(policy_json)),
  published_by_account_id TEXT REFERENCES pilot_accounts(id),
  published_at TEXT NOT NULL
);

CREATE TABLE growth_policy_state (
  id INTEGER PRIMARY KEY NOT NULL CHECK(id=1),
  published_version INTEGER NOT NULL REFERENCES growth_policy_versions(version),
  draft_stage TEXT NOT NULL CHECK(draft_stage IN ('private_pilot','campus_beta','campus_launch','public_access')),
  draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)),
  draft_revision INTEGER NOT NULL CHECK(draft_revision > 0),
  draft_updated_by_account_id TEXT REFERENCES pilot_accounts(id),
  draft_updated_at TEXT NOT NULL
);

INSERT INTO growth_policy_versions(version,stage,policy_json,published_at) VALUES(
  1,'private_pilot',
  '{"enrolmentMode":"invite_only","pauseNewEnrolments":false,"allowPrivateInvitations":true,"allowCampaignEnrolment":true,"allowFriendReferralEnrolment":true,"allowExistingFriendRequests":true,"publicEnrolmentAvailable":false,"totalEnrolmentCap":null,"defaultInvitationExpiryHours":168,"privateInvitationMaxRedemptions":1,"campaignDefaultMaxRedemptions":100,"campaignMaxRedemptions":1000,"friendReferralExpiryHours":168,"friendReferralMaxRedemptions":20,"privateInvitationsPerHour":5,"friendInvitationsPerHour":5,"friendRequestsPerHour":20}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
INSERT INTO growth_policy_state(id,published_version,draft_stage,draft_policy_json,draft_revision,draft_updated_at)
SELECT 1,version,stage,policy_json,1,published_at FROM growth_policy_versions WHERE version=1;

-- Campaign-wide capacity is enforced in addition to each distribution link.
ALTER TABLE growth_campaigns ADD COLUMN society_id TEXT;
ALTER TABLE growth_campaigns ADD COLUMN starts_at TEXT;
ALTER TABLE growth_campaigns ADD COLUMN max_redemptions INTEGER NOT NULL DEFAULT 1000 CHECK(max_redemptions > 0);
ALTER TABLE growth_campaigns ADD COLUMN redemption_count INTEGER NOT NULL DEFAULT 0 CHECK(redemption_count >= 0);
ALTER TABLE growth_campaigns ADD COLUMN last_claim_id TEXT;
ALTER TABLE growth_campaigns ADD COLUMN updated_at TEXT;
UPDATE growth_campaigns SET
  max_redemptions=MAX(1,COALESCE((SELECT SUM(i.max_redemptions) FROM invitation_contexts x
    JOIN access_invitations i ON i.id=x.invitation_id WHERE x.campaign_id=growth_campaigns.id),1000)),
  redemption_count=COALESCE((SELECT SUM(i.redemption_count) FROM invitation_contexts x
    JOIN access_invitations i ON i.id=x.invitation_id WHERE x.campaign_id=growth_campaigns.id),0),
  starts_at=created_at,updated_at=created_at;

CREATE TABLE campaign_distribution_links (
  invitation_id TEXT PRIMARY KEY NOT NULL REFERENCES access_invitations(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES growth_campaigns(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('society','organic_social','paid_social','partner','direct','other')),
  source TEXT NOT NULL,
  format TEXT,
  placement TEXT,
  creative_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(campaign_id,invitation_id)
);
CREATE INDEX campaign_distribution_dimensions ON campaign_distribution_links(campaign_id,channel,source,format,placement);
INSERT INTO campaign_distribution_links(invitation_id,campaign_id,label,channel,source,format,placement,created_at)
SELECT x.invitation_id,x.campaign_id,COALESCE(i.label,c.name),'society',c.campaign_key,'link','legacy',i.created_at
FROM invitation_contexts x JOIN access_invitations i ON i.id=x.invitation_id
JOIN growth_campaigns c ON c.id=x.campaign_id
WHERE x.campaign_id IS NOT NULL
ON CONFLICT(invitation_id) DO NOTHING;

-- Rebuild first-touch attribution to support distribution channels and retain
-- the exact acquisition link. No friendship or access row is changed.
ALTER TABLE account_attribution RENAME TO account_attribution_stage2;
CREATE TABLE account_attribution (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  direct_channel TEXT NOT NULL CHECK(direct_channel IN ('legacy_pilot','private_invitation','society','organic_social','paid_social','partner','direct','friend_referral','other')),
  campaign_id TEXT REFERENCES growth_campaigns(id),
  acquisition_invitation_id TEXT REFERENCES access_invitations(id),
  referrer_account_id TEXT REFERENCES pilot_accounts(id),
  root_campaign_id TEXT REFERENCES growth_campaigns(id),
  acquired_at TEXT NOT NULL,
  CHECK((direct_channel='friend_referral' AND campaign_id IS NULL AND referrer_account_id IS NOT NULL)
     OR (direct_channel IN ('legacy_pilot','private_invitation') AND campaign_id IS NULL AND referrer_account_id IS NULL)
     OR (direct_channel IN ('society','organic_social','paid_social','partner','direct','other') AND campaign_id IS NOT NULL AND referrer_account_id IS NULL)),
  CHECK(referrer_account_id IS NULL OR referrer_account_id != account_id)
);
INSERT INTO account_attribution(account_id,direct_channel,campaign_id,acquisition_invitation_id,referrer_account_id,root_campaign_id,acquired_at)
SELECT a.account_id,a.direct_channel,a.campaign_id,x.invitation_id,a.referrer_account_id,a.root_campaign_id,a.acquired_at
FROM account_attribution_stage2 a LEFT JOIN account_access x ON x.account_id=a.account_id;
DROP TABLE account_attribution_stage2;
CREATE INDEX account_attribution_referrer ON account_attribution(referrer_account_id);
CREATE INDEX account_attribution_root ON account_attribution(root_campaign_id,direct_channel);
CREATE INDEX account_attribution_invitation ON account_attribution(acquisition_invitation_id);
