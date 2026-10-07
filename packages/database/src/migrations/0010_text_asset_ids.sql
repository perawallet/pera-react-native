DROP TABLE `account_asset_holdings`;
--> statement-breakpoint
CREATE TABLE `account_asset_holdings` (
	`account_address` text NOT NULL,
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`amount` text DEFAULT '0' NOT NULL,
	`is_frozen` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`account_address`, `asset_id`, `network`)
);
--> statement-breakpoint
DROP TABLE `assets_node`;
--> statement-breakpoint
CREATE TABLE `assets_node` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`decimals` integer DEFAULT 0 NOT NULL,
	`creator_address` text DEFAULT '' NOT NULL,
	`total_supply` text DEFAULT '0' NOT NULL,
	`name` text,
	`unit_name` text,
	`url` text,
	`metadata` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
--> statement-breakpoint
DROP TABLE `assets_pera`;
--> statement-breakpoint
CREATE TABLE `assets_pera` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`verification_tier` text DEFAULT 'unverified' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`is_favorited` integer DEFAULT false NOT NULL,
	`asset_type` text,
	`pera_metadata_json` text,
	`updated_at` integer NOT NULL,
	`first_seen_at` integer,
	PRIMARY KEY(`asset_id`, `network`)
);
--> statement-breakpoint
DROP TABLE `asset_prices`;
--> statement-breakpoint
CREATE TABLE `asset_prices` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`usd_price` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
--> statement-breakpoint
DROP TABLE `asset_price_misses`;
--> statement-breakpoint
CREATE TABLE `asset_price_misses` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`attempted_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
