-- Read-only aggregates for the seven current Semester tables.
-- Run on demand after schema exists. Scans consume D1 read allowance.
-- NULL means JSON payload measurement is not applicable to that table.
-- These payload bytes are NOT the allocated database size: use d1 info for that.
SELECT 'semesters' AS table_name, COUNT(*) AS row_count,
       COALESCE(SUM(length(CAST(data AS BLOB))), 0) AS board_json_bytes
FROM semesters
UNION ALL
SELECT 'semester_recovery', COUNT(*),
       COALESCE(SUM(length(CAST(data AS BLOB))), 0)
FROM semester_recovery
UNION ALL SELECT 'course_plans', COUNT(*), NULL FROM course_plans
UNION ALL SELECT 'friend_profiles', COUNT(*), NULL FROM friend_profiles
UNION ALL SELECT 'friend_invites', COUNT(*), NULL FROM friend_invites
UNION ALL SELECT 'friendships', COUNT(*), NULL FROM friendships
UNION ALL SELECT 'friend_rate_limits', COUNT(*), NULL FROM friend_rate_limits;

-- Count owners only once across current and recovery boards, including an owner
-- with only a recovery row. This is not the number of registered Auth users.
WITH board_sizes AS (
  SELECT owner, length(CAST(data AS BLOB)) AS bytes FROM semesters
  UNION ALL
  SELECT owner, length(CAST(data AS BLOB)) AS bytes FROM semester_recovery
), per_owner AS (
  SELECT owner, SUM(bytes) AS bytes FROM board_sizes GROUP BY owner
)
SELECT COUNT(*) AS board_owners,
       COALESCE(SUM(bytes), 0) AS combined_board_json_bytes,
       AVG(bytes) AS mean_board_json_bytes_per_owner,
       MAX(bytes) AS max_board_json_bytes_per_owner
FROM per_owner;
