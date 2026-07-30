ALTER TABLE `feishu_pending_records` ADD `rawText` text;--> statement-breakpoint
ALTER TABLE `feishu_pending_records` ADD `awaitingClient` tinyint DEFAULT 0;