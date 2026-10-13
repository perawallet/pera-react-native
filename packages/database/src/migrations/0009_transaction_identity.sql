CREATE TABLE `transactions_new` (
	`id` text NOT NULL,
	`network` text NOT NULL,
	`tx_type` text NOT NULL,
	`sender` text NOT NULL,
	`asset_sender` text,
	`receiver` text,
	`confirmed_round` integer,
	`round_time` integer,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`fee` text NOT NULL,
	`group_id` text,
	`amount` text,
	`close_to` text,
	`close_amount` text,
	`application_id` text,
	`inner_transaction_count` integer,
	`asset_json` text,
	`swap_group_detail_json` text,
	`interpreted_meaning_json` text,
	`balance_impacts_json` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`network`, `id`)
);
--> statement-breakpoint
INSERT INTO `transactions_new` (`id`, `network`, `tx_type`, `sender`, `asset_sender`, `receiver`, `confirmed_round`, `round_time`, `fee`, `group_id`, `amount`, `close_to`, `close_amount`, `application_id`, `inner_transaction_count`, `asset_json`, `swap_group_detail_json`, `interpreted_meaning_json`, `balance_impacts_json`, `updated_at`)
SELECT `id`, `network`, `tx_type`, `sender`, `asset_sender`, `receiver`, `confirmed_round`, `round_time`, `fee`, `group_id`, `amount`, `close_to`, `close_amount`, `application_id`, `inner_transaction_count`, `asset_json`, `swap_group_detail_json`, `interpreted_meaning_json`, `balance_impacts_json`, `updated_at` FROM `transactions`;
--> statement-breakpoint
DROP TABLE `transactions`;
--> statement-breakpoint
ALTER TABLE `transactions_new` RENAME TO `transactions`;
--> statement-breakpoint
CREATE INDEX `transactions_network_idx` ON `transactions` (`network`);
--> statement-breakpoint
CREATE TABLE `account_transactions_new` (
	`account_address` text NOT NULL,
	`transaction_id` text NOT NULL,
	`network` text NOT NULL,
	`asset_id` text,
	`round_time` integer,
	PRIMARY KEY(`account_address`, `transaction_id`, `network`)
);
--> statement-breakpoint
INSERT INTO `account_transactions_new` (`account_address`, `transaction_id`, `network`, `asset_id`, `round_time`)
SELECT `account_address`, `transaction_id`, `network`, `asset_id`, `round_time` FROM `account_transactions`;
--> statement-breakpoint
DROP TABLE `account_transactions`;
--> statement-breakpoint
ALTER TABLE `account_transactions_new` RENAME TO `account_transactions`;
