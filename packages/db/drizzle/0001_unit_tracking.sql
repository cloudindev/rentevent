CREATE TABLE "unit_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"container_unit_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unit_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"order_id" uuid,
	"note" text,
	"user_id" text,
	"user_name" text
);
--> statement-breakpoint
ALTER TABLE "item_units" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "item_units" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "item_units" ADD COLUMN "parent_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "item_units" ADD COLUMN "current_order_id" uuid;--> statement-breakpoint
ALTER TABLE "item_units" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "container" text;--> statement-breakpoint
ALTER TABLE "pick_lists" ADD COLUMN "scanned_containers" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_contents" ADD CONSTRAINT "unit_contents_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_contents" ADD CONSTRAINT "unit_contents_container_unit_id_item_units_id_fk" FOREIGN KEY ("container_unit_id") REFERENCES "public"."item_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_contents" ADD CONSTRAINT "unit_contents_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_events" ADD CONSTRAINT "unit_events_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_events" ADD CONSTRAINT "unit_events_unit_id_item_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."item_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_events" ADD CONSTRAINT "unit_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unit_contents_idx" ON "unit_contents" USING btree ("tenant_id","container_unit_id","item_id");--> statement-breakpoint
CREATE INDEX "unit_events_unit_idx" ON "unit_events" USING btree ("tenant_id","unit_id","created_at");--> statement-breakpoint
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_parent_unit_id_item_units_id_fk" FOREIGN KEY ("parent_unit_id") REFERENCES "public"."item_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_current_order_id_orders_id_fk" FOREIGN KEY ("current_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_units_parent_idx" ON "item_units" USING btree ("tenant_id","parent_unit_id");--> statement-breakpoint
CREATE INDEX "item_units_order_idx" ON "item_units" USING btree ("tenant_id","current_order_id");--> statement-breakpoint
-- backfill: units already out are linked to the order whose loading scanned them
UPDATE "item_units" u SET "current_order_id" = pl."order_id"
FROM "pick_list_lines" pll JOIN "pick_lists" pl ON pl."id" = pll."pick_list_id"
WHERE pl."kind" = 'salida' AND pl."status" = 'en_obra' AND pll."item_id" = u."item_id"
  AND u."serial" = ANY(pll."scanned_units") AND u."status" = 'en_obra' AND u."current_order_id" IS NULL;
