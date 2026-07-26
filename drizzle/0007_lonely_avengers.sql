CREATE TABLE `arsenal_generated` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('方案类','弹药类','话术类') NOT NULL,
	`title` varchar(300) NOT NULL,
	`prompt` text NOT NULL,
	`docIds` json,
	`generatedContent` text NOT NULL,
	`clientId` int,
	`targetContact` varchar(100),
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `arsenal_generated_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listprice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productLine` varchar(100) NOT NULL,
	`productName` varchar(200) NOT NULL,
	`model` varchar(100),
	`pid` varchar(100),
	`sku` varchar(200),
	`unit` varchar(100),
	`listPriceUsd` float NOT NULL,
	`tier1PriceUsd` float,
	`tier2PriceUsd` float,
	`tier3PriceUsd` float,
	`billingCycle` varchar(50) DEFAULT 'Annual',
	`specs` text,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `listprice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_docs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`productLine` varchar(100),
	`tags` json,
	`filename` varchar(300) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`extractedText` text,
	`uploadedBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_docs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`listpriceItemId` int,
	`productName` varchar(200) NOT NULL,
	`model` varchar(100),
	`unit` varchar(100),
	`quantity` int NOT NULL DEFAULT 1,
	`listPriceUsd` float NOT NULL,
	`discountPct` float NOT NULL DEFAULT 0,
	`discountedPriceUsd` float NOT NULL,
	`subtotalListPrice` float NOT NULL,
	`subtotalDiscounted` float NOT NULL,
	`notes` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quote_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteNumber` varchar(50) NOT NULL,
	`clientId` int,
	`clientName` varchar(200),
	`contactName` varchar(100),
	`validUntil` timestamp,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`totalListPrice` float NOT NULL DEFAULT 0,
	`totalDiscountedPrice` float NOT NULL DEFAULT 0,
	`notes` text,
	`status` enum('草稿','已发送','已接受','已拒绝','已过期') NOT NULL DEFAULT '草稿',
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`)
);
