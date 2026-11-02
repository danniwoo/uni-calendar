import { sqliteTable, text, integer, real, uniqueIndex, primaryKey, index } from "drizzle-orm/sqlite-core";
export const semesters = sqliteTable("semesters", {
  owner: text("owner").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
export const semesterRecovery = sqliteTable("semester_recovery", {
  owner: text("owner").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Course planning is independent of the active, private semester board.
export const coursePlans = sqliteTable("course_plans", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  university: text("university").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  session: text("session").notNull(),
  status: text("status").notNull(),
  credits: real("credits"),
  finalMark: real("final_mark"),
  finalGrade: text("final_grade"),
  wamExcluded: integer("wam_excluded").notNull().default(0),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("course_plans_offering").on(table.owner, table.university, table.code, table.year, table.session), index("course_plans_owner_term").on(table.owner, table.year, table.session, table.id)]);

export const friendProfiles = sqliteTable("friend_profiles", {
  owner: text("owner").primaryKey(),
  id: text("id").notNull().unique(),
  name: text("name").notNull(),
  sharing: integer("sharing").notNull().default(0),
  revision: integer("revision").notNull().default(1),
});

export const friendInvites = sqliteTable("friend_invites", {
  owner: text("owner").primaryKey(),
  codeHash: text("code_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  revision: integer("revision").notNull().default(1),
});

export const friendships = sqliteTable("friendships", {
  id: text("id").notNull().unique(),
  a: text("a").notNull(),
  b: text("b").notNull(),
  requester: text("requester").notNull(),
  status: text("status").notNull(),
  blockedBy: text("blocked_by"),
  revision: integer("revision").notNull().default(1),
}, table => [primaryKey({columns:[table.a, table.b]}), index("friendships_b").on(table.b), index("friendships_requester_status").on(table.requester,table.status)]);

// One bounded counter row per owner/action; windows reset in place.
export const friendRateLimits = sqliteTable("friend_rate_limits", {
  owner:text("owner").notNull(), action:text("action").notNull(),
  windowStart:integer("window_start").notNull(), count:integer("count").notNull(),
}, table => [primaryKey({columns:[table.owner,table.action]})]);
