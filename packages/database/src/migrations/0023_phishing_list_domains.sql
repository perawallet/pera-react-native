CREATE TABLE `phishing_list_domains` (
	`source` text NOT NULL,
	`generation` integer NOT NULL,
	`kind` text NOT NULL,
	`domain` text NOT NULL,
	PRIMARY KEY(`source`, `generation`, `kind`, `domain`)
);
--> statement-breakpoint
CREATE INDEX `phishing_list_domains_domain_idx` ON `phishing_list_domains` (`domain`);
