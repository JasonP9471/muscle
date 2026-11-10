CREATE TABLE `nutrition_rate_limits` (
	`identity_hash` text PRIMARY KEY NOT NULL,
	`request_count` integer NOT NULL,
	`window_started_at` integer NOT NULL,
	`reset_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `nutrition_rate_limits_request_count_nonnegative` CHECK (`request_count` >= 0)
);
--> statement-breakpoint
CREATE INDEX `nutrition_rate_limits_reset_at_idx` ON `nutrition_rate_limits` (`reset_at`);
