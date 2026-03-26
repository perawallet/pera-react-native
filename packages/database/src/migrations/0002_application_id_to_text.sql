CREATE TABLE `transactions_new` (
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
	`application_id` text,
	`inner_transaction_count` integer,
	`asset_json` text,
	`swap_group_detail_json` text,
	`interpreted_meaning_json` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `transactions_new` SELECT
	`id`, `network`, `tx_type`, `sender`, `receiver`, `confirmed_round`, `round_time`, `fee`, `group_id`, `amount`, `close_to`,
	CAST(`application_id` AS text), `inner_transaction_count`, `asset_json`, `swap_group_detail_json`, `interpreted_meaning_json`, `updated_at`
FROM `transactions`;
--> statement-breakpoint
DROP TABLE `transactions`;
--> statement-breakpoint
ALTER TABLE `transactions_new` RENAME TO `transactions`;
