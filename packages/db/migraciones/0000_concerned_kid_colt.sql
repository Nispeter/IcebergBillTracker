CREATE TABLE `cuentas` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`origin_device_id` text NOT NULL,
	`nombre` text NOT NULL,
	`tipo` text NOT NULL,
	`moneda` text DEFAULT 'CLP' NOT NULL,
	`saldo_inicial_minor` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cuentas_hogar_idx` ON `cuentas` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `movimientos` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`origin_device_id` text NOT NULL,
	`cuenta_id` text NOT NULL,
	`tipo` text NOT NULL,
	`monto_minor` integer NOT NULL,
	`moneda` text DEFAULT 'CLP' NOT NULL,
	`ocurrido_en` text NOT NULL,
	`nombre` text NOT NULL,
	`categoria_id` text,
	`notas` text
);
--> statement-breakpoint
CREATE INDEX `mov_hogar_fecha_idx` ON `movimientos` (`household_id`,`deleted_at`,`ocurrido_en`);--> statement-breakpoint
CREATE INDEX `mov_cuenta_idx` ON `movimientos` (`cuenta_id`);--> statement-breakpoint
CREATE INDEX `mov_categoria_idx` ON `movimientos` (`categoria_id`);