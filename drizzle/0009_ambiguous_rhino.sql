CREATE TABLE `meddpicc_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`dimension` varchar(50) NOT NULL,
	`score` int NOT NULL,
	`note` text NOT NULL,
	`authorRole` enum('AD','SAM','SA','RSM') NOT NULL DEFAULT 'SAM',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meddpicc_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `visitType` varchar(50) DEFAULT '拜访';--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `transcriptText` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `hookTopicSuggestion` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `securityAngleSuggestion` text;--> statement-breakpoint
ALTER TABLE `pod_tasks` ADD `sourceActionId` int;--> statement-breakpoint
ALTER TABLE `pod_tasks` ADD `priority` enum('高','中','低') DEFAULT '中';