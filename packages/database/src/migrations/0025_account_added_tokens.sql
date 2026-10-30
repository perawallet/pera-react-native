CREATE TABLE `account_added_tokens` (
	`account_address` text NOT NULL,
	`scope` text NOT NULL,
	`asset_id` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`account_address`, `scope`, `asset_id`)
);
