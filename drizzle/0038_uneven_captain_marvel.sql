ALTER TABLE `arsenal_generated` ADD `opportunityId` int;--> statement-breakpoint
ALTER TABLE `arsenal_generated` ADD `adoptionStatus` enum('待确认','已采用','未采用') DEFAULT '待确认' NOT NULL;--> statement-breakpoint
ALTER TABLE `arsenal_generated` ADD `customerFeedback` text;--> statement-breakpoint
ALTER TABLE `arsenal_generated` ADD `outcomeUpdatedAt` timestamp;