CREATE TABLE `win_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`bizObjective` text,
	`valueProposition` text,
	`competitorSummary` text,
	`winStrategy` text,
	`keyMilestones` text,
	`riskAndMitigation` text,
	`aiSuggestion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `win_strategies_id` PRIMARY KEY(`id`),
	CONSTRAINT `win_strategies_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `stance` enum('支持','中立','反对','未知') DEFAULT '未知';