CREATE TABLE `arsenal_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weaponId` int NOT NULL,
	`filename` varchar(300) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`uploadedBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `arsenal_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `arsenal_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weaponId` int NOT NULL,
	`pricingTier` varchar(100) NOT NULL,
	`listPrice` varchar(200) NOT NULL,
	`currency` varchar(20) DEFAULT 'CNY',
	`billingCycle` enum('一次性','年费','月费','按量') DEFAULT '年费',
	`minQty` int DEFAULT 1,
	`notes` text,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `arsenal_pricing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `arsenal_weapons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('产品类','方案类','弹药类','话术类','报价单') NOT NULL,
	`title` varchar(200) NOT NULL,
	`subtitle` varchar(300),
	`tags` json,
	`description` text,
	`usageScenario` text,
	`targetRole` enum('CEO','CTO','CFO','董事长','IT负责人','安全负责人','采购','通用') DEFAULT '通用',
	`listPrice` varchar(200),
	`currency` varchar(20) DEFAULT 'CNY',
	`isDemo` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `arsenal_weapons_id` PRIMARY KEY(`id`)
);
