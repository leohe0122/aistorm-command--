CREATE TABLE `ai_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`opportunityId` int,
	`reviewType` enum('0to1','1toN','buyingGroup','visitTrend') NOT NULL,
	`content` text NOT NULL,
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `effectiveness_baselines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`currentMttr` varchar(50),
	`currentDetectionRate` varchar(50),
	`socHeadcount` int,
	`falsePositiveRate` varchar(50),
	`complianceAuditDays` int,
	`complianceIncidentsPerYear` int,
	`downtimeHoursPerYear` varchar(50),
	`estimatedIncidentCost` varchar(100),
	`dataSource` enum('客户提供','行业基准','AI估算','混合') DEFAULT 'AI估算',
	`quantifiedPainStatement` text,
	`roiSummary` text,
	`estimatedAnnualValue` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `effectiveness_baselines_id` PRIMARY KEY(`id`),
	CONSTRAINT `effectiveness_baselines_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `assignedSamId` int;--> statement-breakpoint
ALTER TABLE `clients` ADD `assignedSamName` varchar(100);