CREATE TABLE `client_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`securityTeamSize` int,
	`mttr` int,
	`annualComplianceCost` int,
	`lastBreachYear` int,
	`currentVendors` text,
	`contractRenewalDate` timestamp,
	`itBudgetRange` varchar(50),
	`additionalNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_metrics_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `informalContactCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `customerInitiatedCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `hasWhatsapp` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `hasFeishu` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `lastInformalContact` timestamp;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `contactType` enum('formal_meeting','dinner_meeting','phone_call','video_call','instant_message','event','customer_initiated') DEFAULT 'formal_meeting';--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `initiatedBy` enum('sam','customer','mutual') DEFAULT 'sam';--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `entrySource` enum('manual','feishu_miaoji','whatsapp_quick','feishu_bot') DEFAULT 'manual';