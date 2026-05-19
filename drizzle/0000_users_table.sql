CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"role" text DEFAULT 'member' NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "role_check" CHECK ("users"."role" IN ('admin', 'member'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "users_read_own" ON "users"
  FOR SELECT TO authenticated
  USING (auth.uid() = id);