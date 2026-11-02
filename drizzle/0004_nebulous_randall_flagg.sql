CREATE TABLE `friend_rate_limits` (
	`owner` text NOT NULL,
	`action` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`owner`, `action`)
);
--> statement-breakpoint
ALTER TABLE `friend_invites` ADD `revoked_at` text;--> statement-breakpoint
ALTER TABLE `friend_invites` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `course_plans_owner_term` ON `course_plans` (`owner`,`year`,`session`,`id`);--> statement-breakpoint
CREATE INDEX `friendships_requester_status` ON `friendships` (`requester`,`status`);