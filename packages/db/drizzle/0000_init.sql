CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'solo_lectura' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false,
	"locale" text DEFAULT 'es' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"author_name" text,
	"pinned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shift_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"status" text DEFAULT 'asignado' NOT NULL,
	"role" text,
	"override_reason" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"user_name" text,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"diff" jsonb
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT 0 NOT NULL,
	"opening_date" date
);
--> statement-breakpoint
CREATE TABLE "bank_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"booked_on" date NOT NULL,
	"concept" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category" text,
	"invoice_id" uuid,
	"purchase_id" uuid,
	"reconciled" boolean DEFAULT false NOT NULL,
	"forecast" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blobs" (
	"key" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bom_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"family_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"formula" text NOT NULL,
	"condition" text,
	"group" text DEFAULT 'estructura' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "contact_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_id" uuid NOT NULL,
	"label" text DEFAULT 'Principal' NOT NULL,
	"line1" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'ES' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"email" text,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'cliente' NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"email" text,
	"phone" text,
	"website" text,
	"discount_pct" numeric(12, 2) DEFAULT 0 NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"key" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "counters_tenant_id_key_pk" PRIMARY KEY("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "delivery_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text DEFAULT 'entrega' NOT NULL,
	"number" text NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signed_name" text,
	"signature" text,
	"signed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"direction" text DEFAULT 'saliente' NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"thread_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'enviado' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid,
	"kind" text DEFAULT 'revision' NOT NULL,
	"result" text DEFAULT 'ok' NOT NULL,
	"inspector" text,
	"notes" text,
	"inspected_at" timestamp with time zone NOT NULL,
	"next_due_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'normal' NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"series_id" uuid,
	"number" integer,
	"full_number" text,
	"kind" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"client_id" uuid,
	"order_id" uuid,
	"project_id" uuid,
	"rectifies_id" uuid,
	"rectification_reason" text,
	"issue_date" date,
	"due_date" date,
	"client_snapshot" jsonb,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"paid" numeric(12, 2) DEFAULT 0 NOT NULL,
	"notes" text,
	"record_hash" text,
	"previous_hash" text,
	"verifactu_status" text DEFAULT 'no_enviada' NOT NULL,
	"einvoice_status" text DEFAULT 'no_enviada' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_id" uuid NOT NULL,
	"serial" text NOT NULL,
	"qr_code" text NOT NULL,
	"status" text DEFAULT 'disponible' NOT NULL,
	"purchased_at" date,
	"last_inspection_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"kind" text DEFAULT 'granel' NOT NULL,
	"unit" text DEFAULT 'ud' NOT NULL,
	"role" text DEFAULT 'otro' NOT NULL,
	"role_amount" double precision DEFAULT 1 NOT NULL,
	"weight_kg" double precision DEFAULT 0 NOT NULL,
	"volume_m3" double precision DEFAULT 0 NOT NULL,
	"length_m" double precision,
	"width_m" double precision,
	"height_m" double precision,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"price_mode" text DEFAULT 'unidad' NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"replacement_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"stock_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"stock_repair" numeric(12, 2) DEFAULT 0 NOT NULL,
	"warehouse_id" uuid,
	"location" text,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"pending_validation" boolean DEFAULT false NOT NULL,
	"inspection_interval_days" integer
);
--> statement-breakpoint
CREATE TABLE "job_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shift_id" uuid NOT NULL,
	"worker_id" uuid,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"incidents" text,
	"client_name" text,
	"client_signature" text,
	"completed_at" timestamp with time zone,
	"client_ref" text,
	CONSTRAINT "job_reports_client_ref_unique" UNIQUE("client_ref")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text,
	"name" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kit_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid,
	"order_id" uuid,
	"kind" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"user_id" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"body" text NOT NULL,
	"author_id" text,
	"author_name" text,
	"internal" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"status" text DEFAULT 'enviada' NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"parent_line_id" uuid,
	"kind" text NOT NULL,
	"item_id" uuid,
	"kit_id" uuid,
	"tent_config_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"price_mode" text DEFAULT 'unidad' NOT NULL,
	"discount_pct" numeric(12, 2) DEFAULT 0 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"tax_rate" numeric(12, 2) DEFAULT 21 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"from_bom" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"client_id" uuid,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"event_start" timestamp with time zone,
	"event_end" timestamp with time zone,
	"option_expires_at" timestamp with time zone,
	"discount_pct" numeric(12, 2) DEFAULT 0 NOT NULL,
	"holiday" boolean DEFAULT false NOT NULL,
	"trips" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text
);
--> statement-breakpoint
CREATE TABLE "outbox_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"method" text DEFAULT 'transferencia' NOT NULL,
	"bank_account_id" uuid,
	"reference" text
);
--> statement-breakpoint
CREATE TABLE "pick_list_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pick_list_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"location" text,
	"quantity" numeric(12, 2) NOT NULL,
	"prepared" numeric(12, 2) DEFAULT 0 NOT NULL,
	"loaded" numeric(12, 2) DEFAULT 0 NOT NULL,
	"returned" numeric(12, 2) DEFAULT 0 NOT NULL,
	"damaged" numeric(12, 2) DEFAULT 0 NOT NULL,
	"lost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'por_preparar' NOT NULL,
	"scanned_units" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pick_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text DEFAULT 'salida' NOT NULL,
	"status" text DEFAULT 'por_preparar' NOT NULL,
	"due_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid,
	"venue_id" uuid,
	"location_address" text,
	"lat" double precision,
	"lng" double precision,
	"distance_km" double precision,
	"status" text DEFAULT 'consulta' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"manager_id" text,
	"color" text,
	"description" text,
	"recurring_of_id" uuid
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'factura' NOT NULL,
	"supplier_id" uuid,
	"project_id" uuid,
	"subrental_id" uuid,
	"number" text,
	"issue_date" date NOT NULL,
	"due_date" date,
	"concept" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"base" numeric(12, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"paid_on" date
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"valid_until" date,
	"public_token" text NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"signature_name" text,
	"signature_image" text,
	"signature_ip" text,
	CONSTRAINT "quotes_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid,
	"order_id" uuid,
	"kind" text DEFAULT 'reparacion' NOT NULL,
	"quantity" numeric(12, 2) DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"reason" text NOT NULL,
	"cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_id" uuid NOT NULL,
	"order_id" uuid,
	"project_id" uuid,
	"line_id" uuid,
	"quantity" numeric(12, 2) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone,
	"source" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"entity" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid,
	"order_id" uuid,
	"phase_kind" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"required_people" integer DEFAULT 1 NOT NULL,
	"required_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"estimated_hours" double precision,
	"vehicle_id" uuid,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"notes" text,
	"published" boolean DEFAULT false NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_id" uuid NOT NULL,
	"expected" numeric(12, 2) NOT NULL,
	"counted" numeric(12, 2) NOT NULL,
	"counted_by" text,
	"applied" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structure_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"width" double precision NOT NULL,
	"module_length" double precision DEFAULT 5 NOT NULL,
	"eave_height" double precision NOT NULL,
	"ridge_height" double precision NOT NULL,
	"height_class" text DEFAULT 'baja' NOT NULL,
	"roof_shape" text DEFAULT 'dos_aguas' NOT NULL,
	"truss_item_id" uuid,
	"min_modules" integer DEFAULT 1 NOT NULL,
	"max_modules" integer DEFAULT 20 NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"labor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_mode" text DEFAULT 'm2' NOT NULL,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"parameters_pending" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subrentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_id" uuid,
	"item_id" uuid NOT NULL,
	"project_id" uuid,
	"order_id" uuid,
	"quantity" numeric(12, 2) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'solicitado' NOT NULL,
	"received_quantity" numeric(12, 2) DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"due_at" timestamp with time zone,
	"assignee_id" text
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" text PRIMARY KEY DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"legal_name" text DEFAULT '' NOT NULL,
	"tax_id" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'ES' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"brand_color" text DEFAULT '#F95F40' NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"base_lat" double precision,
	"base_lng" double precision,
	"pricing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"availability_margin_minutes" integer DEFAULT 60 NOT NULL,
	"option_expiry_days" integer DEFAULT 7 NOT NULL,
	"quote_validity_days" integer DEFAULT 30 NOT NULL,
	"quote_terms" text DEFAULT '' NOT NULL,
	"capacity" jsonb DEFAULT '{"coctelM2":0.8,"banqueteM2":1.4,"teatroM2":0.9}'::jsonb NOT NULL,
	"field_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"plan_seats" integer DEFAULT 5 NOT NULL,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"subscription_status" text DEFAULT 'trialing' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"onboarding_done" boolean DEFAULT false NOT NULL,
	"manufacturer_wizard_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tent_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"label" text DEFAULT 'Carpa' NOT NULL,
	"composition" jsonb NOT NULL,
	"bom" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_key" text,
	"share_token" text,
	CONSTRAINT "tent_configurations_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "tent_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"composition" jsonb NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"worker_id" uuid NOT NULL,
	"shift_id" uuid,
	"clock_in" timestamp with time zone NOT NULL,
	"clock_out" timestamp with time zone,
	"lat_in" double precision,
	"lng_in" double precision,
	"lat_out" double precision,
	"lng_out" double precision,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"diet" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'app' NOT NULL,
	"notes" text,
	"edited_by" text,
	"edit_reason" text
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"plate" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'camion' NOT NULL,
	"max_payload_kg" double precision NOT NULL,
	"volume_m3" double precision NOT NULL,
	"licence_required" text DEFAULT 'conductor_c' NOT NULL,
	"itv_until" date,
	"cost_per_km" numeric(12, 2) DEFAULT 0.9 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"ground_type" text DEFAULT 'cesped' NOT NULL,
	"anchoring_allowed" boolean DEFAULT true NOT NULL,
	"access_notes" text,
	"restrictions" text,
	"max_vehicle" text,
	"plan_file_id" uuid,
	"plan_image_url" text,
	"metres_per_pixel" double precision
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"lat" double precision,
	"lng" double precision
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"events" text[] NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_unavailability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"worker_id" uuid NOT NULL,
	"kind" text DEFAULT 'vacaciones' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"type" text DEFAULT 'plantilla' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"training_expires_at" date,
	"cost_per_hour" numeric(12, 2) DEFAULT 18 NOT NULL,
	"weekly_hours_limit" integer DEFAULT 40 NOT NULL,
	"address" text,
	"home_lat" double precision,
	"home_lng" double precision,
	"color" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"entity" text,
	"entity_id" text
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"trigger" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_rules" ADD CONSTRAINT "bom_rules_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_rules" ADD CONSTRAINT "bom_rules_family_id_structure_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."structure_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_rules" ADD CONSTRAINT "bom_rules_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_persons" ADD CONSTRAINT "contact_persons_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_persons" ADD CONSTRAINT "contact_persons_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counters" ADD CONSTRAINT "counters_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_unit_id_item_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."item_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_series_id_invoice_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."invoice_series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_contacts_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_items" ADD CONSTRAINT "kit_items_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_items" ADD CONSTRAINT "kit_items_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_items" ADD CONSTRAINT "kit_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kits" ADD CONSTRAINT "kits_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_unit_id_item_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."item_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_tent_config_id_tent_configurations_id_fk" FOREIGN KEY ("tent_config_id") REFERENCES "public"."tent_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_contacts_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_pick_list_id_pick_lists_id_fk" FOREIGN KEY ("pick_list_id") REFERENCES "public"."pick_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_contacts_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_contacts_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_subrental_id_subrentals_id_fk" FOREIGN KEY ("subrental_id") REFERENCES "public"."subrentals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_unit_id_item_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."item_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structure_families" ADD CONSTRAINT "structure_families_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structure_families" ADD CONSTRAINT "structure_families_truss_item_id_items_id_fk" FOREIGN KEY ("truss_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subrentals" ADD CONSTRAINT "subrentals_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subrentals" ADD CONSTRAINT "subrentals_supplier_id_contacts_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subrentals" ADD CONSTRAINT "subrentals_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subrentals" ADD CONSTRAINT "subrentals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subrentals" ADD CONSTRAINT "subrentals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tent_configurations" ADD CONSTRAINT "tent_configurations_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tent_configurations" ADD CONSTRAINT "tent_configurations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tent_templates" ADD CONSTRAINT "tent_templates_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_unavailability" ADD CONSTRAINT "worker_unavailability_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_unavailability" ADD CONSTRAINT "worker_unavailability_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_idx" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_shift_worker_idx" ON "assignments" USING btree ("shift_id","worker_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("tenant_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "bom_rules_family_idx" ON "bom_rules" USING btree ("tenant_id","family_id");--> statement-breakpoint
CREATE INDEX "contacts_name_idx" ON "contacts" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "emails_entity_idx" ON "emails" USING btree ("tenant_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "files_entity_idx" ON "files" USING btree ("tenant_id","entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_series_code_idx" ON "invoice_series" USING btree ("tenant_id","code","year");--> statement-breakpoint
CREATE INDEX "invoices_issue_idx" ON "invoices" USING btree ("tenant_id","issue_date");--> statement-breakpoint
CREATE UNIQUE INDEX "item_units_qr_idx" ON "item_units" USING btree ("tenant_id","qr_code");--> statement-breakpoint
CREATE UNIQUE INDEX "items_sku_idx" ON "items" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "jobs_pending_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "movements_item_idx" ON "movements" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE INDEX "notes_entity_idx" ON "notes" USING btree ("tenant_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "order_lines" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "orders_period_idx" ON "orders" USING btree ("tenant_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_number_idx" ON "projects" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "projects_dates_idx" ON "projects" USING btree ("tenant_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_order_version_idx" ON "quotes" USING btree ("order_id","version");--> statement-breakpoint
CREATE INDEX "reservations_item_period_idx" ON "reservations" USING btree ("tenant_id","item_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "shifts_period_idx" ON "shifts" USING btree ("tenant_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "families_code_idx" ON "structure_families" USING btree ("tenant_id","code");