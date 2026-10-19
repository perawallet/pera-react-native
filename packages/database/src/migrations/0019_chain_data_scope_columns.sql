ALTER TABLE `assets_node` ADD `chain_data` text;
--> statement-breakpoint
UPDATE `assets_node` SET `chain_data` = json_object('family', 'algorand', 'creatorAddress', `creator_address`) WHERE `network` LIKE 'algorand/%';
--> statement-breakpoint
ALTER TABLE `assets_node` DROP COLUMN `creator_address`;
--> statement-breakpoint
ALTER TABLE `submission_attempts` ADD `chain_data` text;
--> statement-breakpoint
UPDATE `submission_attempts` SET `chain_data` = json_object('family', 'algorand', 'lastValid', `last_valid`) WHERE `last_valid` IS NOT NULL AND `network` LIKE 'algorand/%';
--> statement-breakpoint
ALTER TABLE `submission_attempts` DROP COLUMN `last_valid`;
--> statement-breakpoint
ALTER TABLE `account_asset_holdings` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `account_chain_state` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `assets_node` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `assets_pera` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `asset_prices` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `asset_price_misses` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `transactions` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `account_transactions` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `nfd_cache` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
ALTER TABLE `submission_attempts` RENAME COLUMN `network` TO `scope`;
--> statement-breakpoint
DROP INDEX `transactions_network_idx`;
--> statement-breakpoint
CREATE INDEX `transactions_scope_idx` ON `transactions` (`scope`);
