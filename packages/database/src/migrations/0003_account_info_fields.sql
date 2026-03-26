ALTER TABLE `account_balances` ADD COLUMN `min_balance_micro` text DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE `account_balances` ADD COLUMN `status` text DEFAULT 'Offline' NOT NULL;