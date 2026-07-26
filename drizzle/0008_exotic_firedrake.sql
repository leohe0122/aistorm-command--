ALTER TABLE `action_items` MODIFY COLUMN `responsibleRole` enum('AD','SAM','SA','RSM') NOT NULL;--> statement-breakpoint
ALTER TABLE `pod_tasks` MODIFY COLUMN `assignedRole` enum('AD','SAM','SA','RSM') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `podRole` enum('AD','SAM','SA','RSM') NOT NULL DEFAULT 'SAM';