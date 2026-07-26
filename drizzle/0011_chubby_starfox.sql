CREATE TABLE `kill_sheets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitorName` varchar(100) NOT NULL,
	`productLine` varchar(200),
	`ourProduct` varchar(200),
	`keyDifferentiators` json,
	`weaknesses` json,
	`aiContent` text,
	`sourceClientId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kill_sheets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`stage` enum('建图','进门','定痛','找人','Qualified','POC','商务谈判') NOT NULL DEFAULT '建图',
	`status` enum('活跃','暂停','赢单','丢单') NOT NULL DEFAULT '活跃',
	`competitorName` varchar(200),
	`contactName` varchar(100),
	`estimatedValue` varchar(100),
	`expectedCloseDate` varchar(50),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `action_items` ADD `taskType` enum('external_sales','internal_resource') DEFAULT 'external_sales';--> statement-breakpoint
ALTER TABLE `action_items` ADD `opportunityId` int;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `reportingTo` varchar(100);--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `persona` text;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `breakthroughTip` text;--> statement-breakpoint
ALTER TABLE `pod_tasks` ADD `taskType` enum('external_sales','internal_resource') DEFAULT 'external_sales';--> statement-breakpoint
ALTER TABLE `pod_tasks` ADD `opportunityId` int;