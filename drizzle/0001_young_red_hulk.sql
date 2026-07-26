CREATE TABLE `action_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`title` text NOT NULL,
	`objective` text,
	`suggestedScript` text,
	`responsibleRole` enum('AD','SAM','SA') NOT NULL,
	`priority` enum('高','中','低') NOT NULL DEFAULT '中',
	`timeframe` enum('今日','本周','本月') NOT NULL DEFAULT '本周',
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`aiGenerated` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `champion_ammo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`championName` varchar(100) NOT NULL,
	`ammoType` enum('竞品对标','合规风险量化','ROI测算') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `champion_ammo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameEn` varchar(100),
	`industry` varchar(100),
	`stage` enum('建图','进门','定痛','找人','Qualified','POC','商务谈判') NOT NULL DEFAULT '建图',
	`priority` enum('P0','P1','P2') NOT NULL DEFAULT 'P1',
	`hookTopic` text,
	`securityAngle` text,
	`notes` text,
	`monitorKeywords` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`rawSignal` text NOT NULL,
	`signalType` enum('人事变动','业务扩张','合规事件','招聘信号','技术公告','其他') NOT NULL,
	`aiInterpretation` text,
	`aiRecommendation` text,
	`urgency` enum('高','中','低') NOT NULL DEFAULT '中',
	`isProcessed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meddpicc` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`metricsScore` int NOT NULL DEFAULT 0,
	`metricsNotes` text,
	`economicBuyerScore` int NOT NULL DEFAULT 0,
	`economicBuyerName` varchar(100),
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
	`championName` varchar(100),
	`championNotes` text,
	`competitionScore` int NOT NULL DEFAULT 0,
	`competitionNotes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meddpicc_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meeting_minutes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`meetingDate` timestamp NOT NULL,
	`attendees` text,
	`keyPoints` text NOT NULL,
	`aiMinutes` text,
	`nextSteps` text,
	`responsiblePerson` varchar(100),
	`dueDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meeting_minutes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `one_pagers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`targetExecutive` varchar(100) NOT NULL,
	`targetTitle` varchar(100),
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `one_pagers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunity_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`overallScore` int NOT NULL,
	`meddpiccScore` int NOT NULL,
	`signalScore` int NOT NULL,
	`riskLevel` enum('高风险','中风险','低风险') NOT NULL,
	`aiAnalysis` text,
	`warnings` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunity_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pod_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`assignedRole` enum('AD','SAM','SA') NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`dueDate` timestamp,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pod_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `podRole` enum('AD','SAM','SA') DEFAULT 'SAM' NOT NULL;