CREATE TABLE `demo_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`recipientName` varchar(100) NOT NULL,
	`recipientEmail` varchar(320),
	`note` text,
	`createdBy` varchar(100),
	`expiresAt` timestamp,
	`accessCount` int NOT NULL DEFAULT 0,
	`lastAccessAt` timestamp,
	`lastAccessIp` varchar(64),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demo_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `demo_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `email_users` ADD `lastLoginIp` varchar(45);