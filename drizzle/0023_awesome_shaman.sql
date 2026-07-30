CREATE TABLE `feishu_pending_records` (
	`id` varchar(32) NOT NULL,
	`clientId` int NOT NULL,
	`clientName` varchar(100) NOT NULL,
	`contactType` varchar(50) NOT NULL,
	`initiatedBy` varchar(20) NOT NULL,
	`keyPoints` text NOT NULL,
	`attendees` varchar(200),
	`openId` varchar(100) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feishu_pending_records_id` PRIMARY KEY(`id`)
);
