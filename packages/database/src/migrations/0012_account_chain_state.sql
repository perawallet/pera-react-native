CREATE TABLE `account_chain_state` (
	`account_address` text NOT NULL,
	`network` text NOT NULL,
	`native_balance` text NOT NULL,
	`chain_data` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`account_address`, `network`)
);
