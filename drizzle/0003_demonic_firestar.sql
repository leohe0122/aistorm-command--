CREATE TABLE `deal_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`reviewDate` timestamp NOT NULL,
	`content` text NOT NULL,
	`nextSteps` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_reviews_id` PRIMARY KEY(`id`)
);
