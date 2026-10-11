CREATE TABLE `ai_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feature` varchar(64) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`model` varchar(100),
	`tier` varchar(16),
	`promptVersion` varchar(64),
	`status` enum('success','error') NOT NULL,
	`latencyMs` int NOT NULL,
	`promptTokens` int,
	`completionTokens` int,
	`error` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` enum('client','opportunity') NOT NULL,
	`targetId` int NOT NULL,
	`clientId` int NOT NULL,
	`framework` enum('meddpicc','win','three_why','go_no_go','coverage') NOT NULL,
	`dimension` varchar(32) NOT NULL,
	`score` int,
	`rationale` text,
	`evidenceIds` json NOT NULL,
	`computedBy` enum('rule','ai') NOT NULL,
	`aiRunId` int,
	`overrideScore` int,
	`overrideReason` text,
	`overrideBy` varchar(100),
	`stale` boolean NOT NULL DEFAULT false,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`opportunityId` int,
	`kind` enum('statement','observation','document','external') NOT NULL DEFAULT 'statement',
	`claim` text NOT NULL,
	`quote` text,
	`subjectName` varchar(150),
	`contactId` int,
	`topics` json NOT NULL,
	`polarity` enum('positive','negative','neutral') NOT NULL DEFAULT 'neutral',
	`occurredAt` timestamp,
	`sourceType` enum('meeting','email','call','document','ai_guidance','purchase_signal','intelligence','manual','legacy') NOT NULL,
	`sourceId` int,
	`sourceKey` varchar(64),
	`sourceExcerpt` text,
	`status` enum('candidate','confirmed','rejected','superseded') NOT NULL DEFAULT 'candidate',
	`supersedesId` int,
	`confidence` enum('high','medium','low'),
	`suggestedScore` int,
	`createdBy` varchar(100) NOT NULL,
	`confirmedBy` varchar(100),
	`confirmedAt` timestamp,
	`aiRunId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_runs_feature_idx` ON `ai_runs` (`feature`,`createdAt`);--> statement-breakpoint
CREATE INDEX `assessments_target_idx` ON `assessments` (`scope`,`targetId`,`framework`);--> statement-breakpoint
CREATE INDEX `assessments_client_idx` ON `assessments` (`clientId`);--> statement-breakpoint
CREATE INDEX `evidence_client_idx` ON `evidence` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `evidence_opportunity_idx` ON `evidence` (`opportunityId`,`status`);--> statement-breakpoint
CREATE INDEX `evidence_source_idx` ON `evidence` (`sourceType`,`sourceId`);