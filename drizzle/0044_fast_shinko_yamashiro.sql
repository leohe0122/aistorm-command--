CREATE TABLE `opportunity_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`role` enum('技术评估','使用方','决策人','评审人','签字人','阻力','无关') NOT NULL DEFAULT '技术评估',
	`source` enum('sam_input','ai_extracted') NOT NULL DEFAULT 'sam_input',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunity_participants_id` PRIMARY KEY(`id`)
);
