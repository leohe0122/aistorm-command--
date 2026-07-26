CREATE TABLE `email_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `email_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`podRole` enum('AD','SAM','SA','RSM') NOT NULL DEFAULT 'SAM',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `isTest` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `clients` ADD `plannedFirstVisitDate` int;--> statement-breakpoint
ALTER TABLE `opportunity_scores` ADD `visitFrequencyScore` int DEFAULT 0;