CREATE TABLE `transactions_new` (
	`id` text NOT NULL,
	`network` text NOT NULL,
	`tx_type` text NOT NULL,
	`sender` text NOT NULL,
	`asset_sender` text,
	`receiver` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`fee` text NOT NULL,
	`amount` text,
	`asset_json` text,
	`interpreted_meaning_json` text,
	`balance_impacts_json` text,
	`chain_data` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`network`, `id`)
);
--> statement-breakpoint
INSERT INTO `transactions_new` (`id`, `network`, `tx_type`, `sender`, `asset_sender`, `receiver`, `status`, `fee`, `amount`, `asset_json`, `interpreted_meaning_json`, `balance_impacts_json`, `chain_data`, `updated_at`)
SELECT `id`, `network`, `tx_type`, `sender`, `asset_sender`, `receiver`, `status`, `fee`, `amount`, `asset_json`, `interpreted_meaning_json`, `balance_impacts_json`,
	CASE WHEN json_valid(`chain_data`) THEN `chain_data` ELSE json_object('algorand', json_object(
		'confirmedRound', `confirmed_round`,
		'roundTime', `round_time`,
		'innerTransactionCount', `inner_transaction_count`,
		'applicationId', `application_id`,
		'closeTo', `close_to`,
		'swapGroupDetail', CASE WHEN json_valid(`swap_group_detail_json`) THEN json(`swap_group_detail_json`) END,
		'groupId', `group_id`,
		'closeAmount', `close_amount`
	)) END,
	`updated_at`
FROM `transactions`;
--> statement-breakpoint
DROP TABLE `transactions`;
--> statement-breakpoint
ALTER TABLE `transactions_new` RENAME TO `transactions`;
--> statement-breakpoint
CREATE INDEX `transactions_network_idx` ON `transactions` (`network`);
