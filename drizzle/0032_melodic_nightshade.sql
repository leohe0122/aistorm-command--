CREATE TABLE `product_doc_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`productLine` varchar(100) NOT NULL,
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_doc_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product_docs` ADD `folderId` int;