ALTER TABLE `account_asset_holdings` ADD `native` text;
--> statement-breakpoint
UPDATE `account_asset_holdings` SET `native` = json_object('family', 'algorand', 'isFrozen', json(CASE WHEN `is_frozen` THEN 'true' ELSE 'false' END)) WHERE `network` LIKE 'algorand/%';
--> statement-breakpoint
ALTER TABLE `account_asset_holdings` DROP COLUMN `is_frozen`;
