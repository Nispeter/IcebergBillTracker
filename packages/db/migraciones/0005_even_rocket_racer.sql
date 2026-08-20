CREATE TABLE `miembros` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`origin_device_id` text NOT NULL,
	`nombre` text NOT NULL,
	`dispositivo_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `miembros_hogar_idx` ON `miembros` (`household_id`,`deleted_at`);