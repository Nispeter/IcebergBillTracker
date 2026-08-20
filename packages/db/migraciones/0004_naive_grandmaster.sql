CREATE TABLE `reglas_categoria` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`origin_device_id` text NOT NULL,
	`patron` text NOT NULL,
	`categoria_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reglas_cat_hogar_idx` ON `reglas_categoria` (`household_id`,`deleted_at`);