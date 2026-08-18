ALTER TABLE `action_items` ADD `sourceReviewId` int;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `aiPostAnalysis` json;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `assignedSaId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `assignedSaName` varchar(100);