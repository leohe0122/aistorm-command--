CREATE TABLE `opportunity_meddpicc` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`clientId` int NOT NULL,
	`metricsScore` int NOT NULL DEFAULT 0,
	`metricsNotes` text,
	`economicBuyerScore` int NOT NULL DEFAULT 0,
	`economicBuyerNotes` text,
	`decisionCriteriaScore` int NOT NULL DEFAULT 0,
	`decisionCriteriaNotes` text,
	`decisionProcessScore` int NOT NULL DEFAULT 0,
	`decisionProcessNotes` text,
	`paperProcessScore` int NOT NULL DEFAULT 0,
	`paperProcessNotes` text,
	`implicatePainScore` int NOT NULL DEFAULT 0,
	`implicatePainNotes` text,
	`championScore` int NOT NULL DEFAULT 0,
	`championNotes` text,
	`competitionScore` int NOT NULL DEFAULT 0,
	`competitionNotes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunity_meddpicc_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunity_meddpicc_opportunityId_unique` UNIQUE(`opportunityId`)
);
--> statement-breakpoint
ALTER TABLE `opportunities` ADD `bizObjective` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `valueProposition` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `champion` varchar(100);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `championStance` enum('支持','中立','反对','未知') DEFAULT '未知';--> statement-breakpoint
ALTER TABLE `opportunities` ADD `blueSheetCompetitor` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `winStrategy` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `keyMilestones` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `riskAndMitigation` text;