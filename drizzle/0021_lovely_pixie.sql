CREATE TABLE `coaching_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`samId` int NOT NULL,
	`samName` varchar(100) NOT NULL,
	`clientId` int,
	`title` varchar(200) NOT NULL,
	`description` text,
	`dueDate` timestamp,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coaching_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `assignedRsmId` int;--> statement-breakpoint
ALTER TABLE `clients` ADD `assignedRsmName` varchar(100);