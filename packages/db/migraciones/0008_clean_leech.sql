CREATE TABLE `categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`origin_device_id` text NOT NULL,
	`nombre` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `categorias_hogar_idx` ON `categorias` (`household_id`,`deleted_at`);