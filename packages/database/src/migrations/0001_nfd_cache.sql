CREATE TABLE `nfd_cache` (
	`address` text NOT NULL,
	`network` text NOT NULL,
	`name` text,
	`image` text,
	`source` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`address`, `network`)
);
