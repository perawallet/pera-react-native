CREATE TABLE `submission_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`network` text NOT NULL,
	`tx_ids_json` text NOT NULL,
	`intent_key_json` text,
	`flow` text NOT NULL,
	`sender` text,
	`status` text NOT NULL,
	`first_valid` integer,
	`last_valid` integer,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `submission_attempts_open_idx` ON `submission_attempts` (`network`, `status`);
--> statement-breakpoint
CREATE INDEX `submission_attempts_retention_idx` ON `submission_attempts` (`status`, `created_at`);
