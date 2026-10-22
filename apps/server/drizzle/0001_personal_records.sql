CREATE SEQUENCE "public"."personal_change_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"prayed_at" timestamp with time zone NOT NULL,
	"memo" text,
	"tag_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_seq" bigint DEFAULT nextval('personal_change_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayer_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"sort_key" text NOT NULL,
	"title" text,
	"detail" text,
	"tag_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"thread_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_seq" bigint DEFAULT nextval('personal_change_seq') NOT NULL,
	CONSTRAINT "prayer_items_content_check" CHECK ("prayer_items"."deleted_at" is not null or coalesce("prayer_items"."title" ~ '\S', false) or coalesce("prayer_items"."detail" ~ '\S', false))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_seq" bigint DEFAULT nextval('personal_change_seq') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_items" ADD CONSTRAINT "prayer_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_items" ADD CONSTRAINT "prayer_items_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_user_prayed_at_idx" ON "notes" USING btree ("user_id","prayed_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "notes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notes_user_change_seq_idx" ON "notes" USING btree ("user_id","change_seq");--> statement-breakpoint
CREATE INDEX "notes_tag_ids_idx" ON "notes" USING gin ("tag_ids");--> statement-breakpoint
CREATE INDEX "prayer_items_note_sort_idx" ON "prayer_items" USING btree ("note_id","sort_key" collate "C");--> statement-breakpoint
CREATE INDEX "prayer_items_user_change_seq_idx" ON "prayer_items" USING btree ("user_id","change_seq");--> statement-breakpoint
CREATE INDEX "prayer_items_user_thread_idx" ON "prayer_items" USING btree ("user_id","thread_id") WHERE "prayer_items"."thread_id" is not null;--> statement-breakpoint
CREATE INDEX "prayer_items_tag_ids_idx" ON "prayer_items" USING gin ("tag_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_unique" ON "tags" USING btree ("user_id",lower("name")) WHERE "tags"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tags_user_change_seq_idx" ON "tags" USING btree ("user_id","change_seq");