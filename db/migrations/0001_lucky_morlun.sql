ALTER TABLE "profiles" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "last_login_at" timestamp with time zone;