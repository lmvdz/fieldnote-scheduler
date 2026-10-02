CREATE TABLE `sessions` (
 `id` text PRIMARY KEY NOT NULL,
 `state` text NOT NULL,
 `revision` integer DEFAULT 0 NOT NULL,
 `updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slots` (
 `slot` text PRIMARY KEY NOT NULL,
 `session` text NOT NULL,
 `state` text NOT NULL,
 `expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
 `id` text PRIMARY KEY NOT NULL,
 `session` text NOT NULL,
 `revision` integer NOT NULL,
 `amount` integer NOT NULL,
 `status` text NOT NULL,
 `capture` text,
 `mode` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_capture_unique` ON `orders` (`capture`);
--> statement-breakpoint
CREATE TABLE `events` (
 `id` text PRIMARY KEY NOT NULL,
 `order_id` text NOT NULL,
 `created` integer NOT NULL
);
