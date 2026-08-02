CREATE TABLE `win_strategy_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`opportunityId` int,
	`aiSuggestion` text NOT NULL,
	`stage` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `win_strategy_history_id` PRIMARY KEY(`id`)
);
