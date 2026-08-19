CREATE TABLE `instancias` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`origin_device_id` text NOT NULL,
	`regla_id` text NOT NULL,
	`ocurre_en` text NOT NULL,
	`estado` text NOT NULL,
	`movimiento_id` text,
	`monto_minor` integer
);
--> statement-breakpoint
CREATE INDEX `inst_regla_fecha_idx` ON `instancias` (`regla_id`,`ocurre_en`);--> statement-breakpoint
CREATE INDEX `inst_hogar_idx` ON `instancias` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `reglas` (
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
	`nombre` text NOT NULL,
	`categoria_id` text,
	`frecuencia` text NOT NULL,
	`cada` integer DEFAULT 1 NOT NULL,
	`desde` text NOT NULL,
	`hasta` text,
	`activa` integer DEFAULT 1 NOT NULL,
	`notas` text
);
--> statement-breakpoint
CREATE INDEX `reglas_hogar_idx` ON `reglas` (`household_id`,`deleted_at`);