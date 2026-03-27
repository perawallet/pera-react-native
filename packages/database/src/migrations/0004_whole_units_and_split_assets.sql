-- Rename balance columns from micro to whole units
ALTER TABLE `account_balances` RENAME COLUMN `algo_balance_micro` TO `algo_balance`;
--> statement-breakpoint
ALTER TABLE `account_balances` RENAME COLUMN `min_balance_micro` TO `min_balance`;
--> statement-breakpoint
-- Split assets table into node-sourced and pera-sourced tables
DROP TABLE IF EXISTS `assets`;
--> statement-breakpoint
CREATE TABLE `assets_node` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`decimals` integer DEFAULT 0 NOT NULL,
	`creator_address` text DEFAULT '' NOT NULL,
	`total_supply` text DEFAULT '"0"' NOT NULL,
	`name` text,
	`unit_name` text,
	`url` text,
	`metadata` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
--> statement-breakpoint
CREATE TABLE `assets_pera` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`verification_tier` text DEFAULT 'unverified' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`asset_type` text,
	`pera_metadata_json` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
