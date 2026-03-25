CREATE TABLE `account_balances` (
	`account_address` text NOT NULL,
	`network` text NOT NULL,
	`algo_balance_micro` text DEFAULT '0' NOT NULL,
	`total_assets_opted_in` integer DEFAULT 0 NOT NULL,
	`total_created_assets` integer DEFAULT 0 NOT NULL,
	`total_apps_opted_in` integer DEFAULT 0 NOT NULL,
	`auth_address` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`account_address`, `network`)
);
--> statement-breakpoint
CREATE TABLE `asset_prices` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`usd_price` text DEFAULT '0' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
