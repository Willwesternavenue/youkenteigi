ALTER TABLE `estimate_items` ADD `category` text;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `sub_category` text;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `approach` text;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `purpose` text;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `hours_design` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `hours_impl` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `hours_test` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `hours_coord` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `estimate_items` ADD `hours_mgmt` real DEFAULT 0 NOT NULL;