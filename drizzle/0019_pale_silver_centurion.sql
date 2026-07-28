ALTER TABLE `intelligence_signals` MODIFY COLUMN `signalType` enum('人事变动','业务扩张','合规事件','合规政策','招聘信号','技术公告','其他') NOT NULL;--> statement-breakpoint
ALTER TABLE `key_contacts` MODIFY COLUMN `influence` enum('决策者','影响者','Champion候选','技术评估者','内部线人') DEFAULT '影响者';--> statement-breakpoint
ALTER TABLE `key_contacts` MODIFY COLUMN `buyingRole` enum('经济决策人','技术决策人','用户影响者','阻碍者','Champion','内部线人','未知') DEFAULT '未知';--> statement-breakpoint
ALTER TABLE `clients` ADD `relationshipNarrative` text;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `championAccessToPower` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `championPoliticalWill` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `championCredibility` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `relationshipEdges` json;