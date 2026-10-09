UPDATE `account_asset_holdings` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `account_balances` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `account_transactions` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `transactions` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `assets_node` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `assets_pera` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `asset_prices` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `asset_price_misses` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `nfd_cache` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
UPDATE `submission_attempts` SET `network` = 'algorand/' || `network` WHERE `network` NOT LIKE '%/%';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_network_idx` ON `transactions` (`network`);
