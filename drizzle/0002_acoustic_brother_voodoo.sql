CREATE TABLE `course_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`university` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`session` text NOT NULL,
	`status` text NOT NULL,
	`credits` real,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_plans_offering` ON `course_plans` (`owner`,`university`,`code`,`year`,`session`);--> statement-breakpoint
CREATE TABLE `friend_invites` (
	`owner` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_invites_code_hash_unique` ON `friend_invites` (`code_hash`);--> statement-breakpoint
CREATE TABLE `friend_profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`sharing` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_profiles_id_unique` ON `friend_profiles` (`id`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` text NOT NULL,
	`a` text NOT NULL,
	`b` text NOT NULL,
	`requester` text NOT NULL,
	`status` text NOT NULL,
	`blocked_by` text,
	`revision` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`a`, `b`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_id_unique` ON `friendships` (`id`);--> statement-breakpoint
CREATE INDEX `friendships_b` ON `friendships` (`b`);