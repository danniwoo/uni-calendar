ALTER TABLE `course_plans` ADD `final_mark` real;--> statement-breakpoint
ALTER TABLE `course_plans` ADD `final_grade` text;--> statement-breakpoint
ALTER TABLE `course_plans` ADD `wam_excluded` integer DEFAULT 0 NOT NULL;