CREATE TABLE `review_approvals` (`id` text PRIMARY KEY NOT NULL, `scope` text NOT NULL, `transactions_json` text NOT NULL, `created_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE `transaction_batches` (`id` text PRIMARY KEY NOT NULL, `batch_id` text NOT NULL, `scope` text NOT NULL, `sender` text NOT NULL, `approval_token` text NOT NULL, `payload_json` text NOT NULL, `tx_ids_json` text NOT NULL, `signed_raw` text, `position` integer NOT NULL, `outcome` text NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_batches_sender_batch_idx` ON `transaction_batches` (`sender`, `batch_id`);
--> statement-breakpoint
CREATE INDEX `transaction_batches_outcome_idx` ON `transaction_batches` (`outcome`);
