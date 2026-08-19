CREATE TABLE `asset_price_misses` (
	`asset_id` text NOT NULL,
	`network` text NOT NULL,
	`attempted_at` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `network`)
);
