ALTER TABLE `clients` ADD `stageChangedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `intelligence_signals` ADD `opportunityId` int;--> statement-breakpoint
ALTER TABLE `intelligence_signals` ADD `opportunityWindowNote` text;--> statement-breakpoint
ALTER TABLE `key_contacts` ADD `buyingRole` enum('经济决策人','技术决策人','用户影响者','阻碍者','Champion','信息来源','未知') DEFAULT '未知';--> statement-breakpoint
ALTER TABLE `opportunities` ADD `stageChangedAt` timestamp DEFAULT (now()) NOT NULL;