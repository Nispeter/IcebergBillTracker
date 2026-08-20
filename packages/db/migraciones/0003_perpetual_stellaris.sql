CREATE TABLE `lotes` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`origin_device_id` text NOT NULL,
	`cuenta_id` text NOT NULL,
	`archivo` text NOT NULL,
	`cantidad` integer NOT NULL,
	`duplicados` integer DEFAULT 0 NOT NULL,
	`desde` text,
	`hasta` text
);
--> statement-breakpoint
CREATE INDEX `lotes_hogar_idx` ON `lotes` (`household_id`,`deleted_at`);--> statement-breakpoint
ALTER TABLE `movimientos` ADD `lote_id` text;--> statement-breakpoint
ALTER TABLE `movimientos` ADD `origen_clave` text;--> statement-breakpoint
CREATE INDEX `mov_origen_idx` ON `movimientos` (`cuenta_id`,`origen_clave`);--> statement-breakpoint
CREATE INDEX `mov_lote_idx` ON `movimientos` (`lote_id`);