-- Better Auth owns user/session/account/verification. Run auth migration first.
CREATE TABLE IF NOT EXISTS pm_entries (
 id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 text text NOT NULL, created_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 timezone text NOT NULL, research boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending', reply text, sources jsonb NOT NULL DEFAULT '[]',
 web_sources jsonb NOT NULL DEFAULT '[]', error text
);
CREATE INDEX IF NOT EXISTS pm_entries_user_date ON pm_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pm_entries_search ON pm_entries USING gin(to_tsvector('english', text));
CREATE TABLE IF NOT EXISTS pm_knowledge (
 id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 title text NOT NULL, content text NOT NULL, kind text NOT NULL,
 version integer NOT NULL DEFAULT 1, source_id uuid REFERENCES pm_entries(id) ON DELETE SET NULL,
 expires_at timestamptz, event_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS pm_knowledge_user ON pm_knowledge(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS pm_knowledge_search ON pm_knowledge USING gin(to_tsvector('english', title || ' ' || content));
CREATE TABLE IF NOT EXISTS pm_revisions (
 id bigserial PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 knowledge_id uuid NOT NULL REFERENCES pm_knowledge(id) ON DELETE CASCADE,
 version integer NOT NULL, snapshot jsonb NOT NULL, source_id uuid REFERENCES pm_entries(id) ON DELETE SET NULL,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(knowledge_id,version)
);
CREATE TABLE IF NOT EXISTS pm_reminders (
 id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 source_id uuid REFERENCES pm_entries(id) ON DELETE SET NULL,
 title text NOT NULL, due_at timestamptz NOT NULL, completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pm_reminders_user ON pm_reminders(user_id,due_at);
CREATE TABLE IF NOT EXISTS pm_changes (
 seq bigserial PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 type text NOT NULL, record_id uuid NOT NULL, data jsonb, deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS pm_changes_cursor ON pm_changes(user_id,seq);
CREATE TABLE IF NOT EXISTS pm_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, id uuid NOT NULL,
 result jsonb NOT NULL, PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS pm_consent (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 ai_enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pm_apple_credentials (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, token text NOT NULL
);
