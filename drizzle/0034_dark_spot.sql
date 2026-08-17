CREATE TABLE `customer_purchase_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`signalType` enum('intent_subject','decision_chain','trigger_event') NOT NULL,
	`subjectName` varchar(150) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`statement` text NOT NULL,
	`sourceType` enum('meeting','customer_message','customer_email','intelligence','other_evidence') NOT NULL,
	`sourceMeetingId` int,
	`sourceReference` text,
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_purchase_signals_id` PRIMARY KEY(`id`)
);
