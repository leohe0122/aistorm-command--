CREATE TABLE `key_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`title` varchar(150),
	`department` varchar(100),
	`influence` enum('决策者','影响者','Champion候选','技术评估者','信息来源') DEFAULT '影响者',
	`relationship` enum('待接触','已识别','初步接触','已接触','建立关系','Champion','已拒绝') DEFAULT '待接触',
	`linkedinUrl` varchar(300),
	`email` varchar(200),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `key_contacts_id` PRIMARY KEY(`id`)
);
