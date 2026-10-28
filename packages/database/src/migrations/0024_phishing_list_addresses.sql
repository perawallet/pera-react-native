CREATE TABLE `phishing_list_addresses` (
	`source` text NOT NULL,
	`generation` integer NOT NULL,
	`address` text NOT NULL,
	PRIMARY KEY(`source`, `generation`, `address`)
);
--> statement-breakpoint
CREATE INDEX `phishing_list_addresses_address_idx` ON `phishing_list_addresses` (`address`);
