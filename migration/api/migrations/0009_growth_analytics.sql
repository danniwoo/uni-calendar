-- Stage 4: privacy-minimised growth/product analytics. This migration starts
-- prospective measurement; it does not infer historical activity from private
-- academic records.
ALTER TABLE account_attribution ADD COLUMN root_acquisition_invitation_id TEXT
  REFERENCES access_invitations(id);

UPDATE account_attribution
SET root_acquisition_invitation_id=acquisition_invitation_id
WHERE direct_channel!='friend_referral';

WITH RECURSIVE ancestry(account_id,root_invitation_id) AS (
  SELECT account_id,acquisition_invitation_id FROM account_attribution
  WHERE direct_channel!='friend_referral'
  UNION ALL
  SELECT child.account_id,parent.root_invitation_id
  FROM account_attribution child JOIN ancestry parent ON parent.account_id=child.referrer_account_id
  WHERE child.direct_channel='friend_referral'
)
UPDATE account_attribution
SET root_acquisition_invitation_id=(SELECT root_invitation_id FROM ancestry WHERE ancestry.account_id=account_attribution.account_id)
WHERE root_acquisition_invitation_id IS NULL;

CREATE INDEX account_attribution_root_invitation
  ON account_attribution(root_acquisition_invitation_id,direct_channel);

CREATE TABLE analytics_state (
  id INTEGER PRIMARY KEY NOT NULL CHECK(id=1),
  taxonomy_version INTEGER NOT NULL CHECK(taxonomy_version>0),
  tracking_started_at TEXT NOT NULL,
  retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 30 AND 730),
  small_cohort_min INTEGER NOT NULL CHECK(small_cohort_min BETWEEN 3 AND 20),
  last_pruned_at TEXT
);
INSERT INTO analytics_state(id,taxonomy_version,tracking_started_at,retention_days,small_cohort_min)
VALUES (1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),400,5);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY NOT NULL,
  taxonomy_version INTEGER NOT NULL CHECK(taxonomy_version=1),
  event_name TEXT NOT NULL CHECK(event_name IN (
    'invitation_landing','auth_completed','semester_imported','semester_board_saved',
    'today_plan_saved','task_completion_saved','friend_link_created',
    'friend_request_sent','friend_request_accepted'
  )),
  event_source TEXT NOT NULL CHECK(event_source IN ('browser','server')),
  account_id TEXT REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  visitor_hash TEXT,
  invitation_id TEXT REFERENCES access_invitations(id),
  campaign_id TEXT REFERENCES growth_campaigns(id),
  feature TEXT CHECK(feature IS NULL OR feature IN (
    'semester_import','semester_board','today_plan','task_completion','friends'
  )),
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  CHECK(account_id IS NOT NULL OR visitor_hash IS NOT NULL)
);
CREATE INDEX analytics_events_time ON analytics_events(event_name,occurred_at);
CREATE INDEX analytics_events_invitation ON analytics_events(invitation_id,event_name,occurred_at);
CREATE INDEX analytics_events_account ON analytics_events(account_id,event_name,occurred_at);
CREATE TRIGGER analytics_events_no_update BEFORE UPDATE ON analytics_events BEGIN
  SELECT RAISE(ABORT,'analytics events are append-only');
END;

-- Repeated feature use is compacted to one privacy-safe row per account/day.
CREATE TABLE analytics_activity_days (
  account_id TEXT NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  feature TEXT NOT NULL CHECK(feature IN (
    'semester_import','semester_board','today_plan','task_completion',
    'assessment_view','friends'
  )),
  activity_kind TEXT NOT NULL CHECK(activity_kind IN ('meaningful','passive','social')),
  first_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  event_count INTEGER NOT NULL CHECK(event_count>0),
  PRIMARY KEY(account_id,activity_date,feature)
);
CREATE INDEX analytics_activity_date ON analytics_activity_days(activity_date,activity_kind,account_id);
CREATE INDEX analytics_activity_account ON analytics_activity_days(account_id,activity_kind,activity_date);

-- Only a coarse academic period key is retained for future cross-semester
-- measurement; no units, grades, assessments or task content are copied here.
CREATE TABLE analytics_semester_usage (
  account_id TEXT NOT NULL REFERENCES pilot_accounts(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  first_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  PRIMARY KEY(account_id,period_key)
);
CREATE INDEX analytics_semester_period ON analytics_semester_usage(period_key,first_at);
