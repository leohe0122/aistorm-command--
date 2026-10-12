CREATE TABLE `ingestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`opportunityId` int,
	`kind` enum('email','meeting_notes','chat','call_notes','document','other') NOT NULL,
	`title` varchar(200),
	`occurredAt` timestamp,
	`rawText` text NOT NULL,
	`status` enum('pending','done','failed') NOT NULL DEFAULT 'pending',
	`error` varchar(500),
	`summary` text,
	`candidateCount` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`createdByName` varchar(100) NOT NULL,
	`aiRunId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `evidence` MODIFY COLUMN `sourceType` enum('meeting','email','call','document','ai_guidance','purchase_signal','intelligence','manual','legacy','ingestion') NOT NULL;--> statement-breakpoint
CREATE INDEX `ingestions_client_idx` ON `ingestions` (`clientId`,`createdAt`);