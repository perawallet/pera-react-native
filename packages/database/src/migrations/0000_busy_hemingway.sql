CREATE TABLE `account_asset_holdings` (
	`account_address` text NOT NULL,
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`amount` text DEFAULT '0' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`account_address`, `asset_id`, `network`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`decimals` integer DEFAULT 0 NOT NULL,
	`creator_address` text DEFAULT '' NOT NULL,
	`total_supply` text DEFAULT '0' NOT NULL,
	`name` text,
	`unit_name` text,
	`url` text,
	`metadata` text,
	`verification_tier` text DEFAULT 'unverified' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`asset_type` text,
	`pera_metadata_json` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
--> statement-breakpoint
CREATE TABLE `account_transactions` (
	`account_address` text NOT NULL,
	`transaction_id` text NOT NULL,
	`network` text NOT NULL,
	`asset_id` text,
	`round_time` integer NOT NULL,
	PRIMARY KEY(`account_address`, `transaction_id`, `network`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`network` text NOT NULL,
	`tx_type` text NOT NULL,
	`sender` text NOT NULL,
	`receiver` text,
	`confirmed_round` integer NOT NULL,
	`round_time` integer NOT NULL,
	`fee` text NOT NULL,
	`group_id` text,
	`amount` text,
	`close_to` text,
	`application_id` integer,
	`inner_transaction_count` integer,
	`asset_json` text,
	`swap_group_detail_json` text,
	`interpreted_meaning_json` text,
	`updated_at` integer NOT NULL
);
