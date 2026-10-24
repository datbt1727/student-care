BEGIN;
CREATE TABLE IF NOT EXISTS sc_users (
 username text PRIMARY KEY,display_name text NOT NULL,role text NOT NULL CHECK(role IN ('admin','staff')),
 active boolean NOT NULL DEFAULT true,must_change boolean NOT NULL DEFAULT true,
 password_hash text NOT NULL,totp_cipher text NOT NULL,last_totp_step bigint NOT NULL DEFAULT -1,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sc_users ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS sc_sessions (
 token_hash text PRIMARY KEY,username text NOT NULL REFERENCES sc_users(username) ON DELETE CASCADE,
 csrf text NOT NULL,expires_at timestamptz NOT NULL,last_seen timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),pending boolean NOT NULL DEFAULT true,remember boolean NOT NULL DEFAULT false
);
ALTER TABLE sc_sessions ADD COLUMN IF NOT EXISTS remember boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS sc_session_user ON sc_sessions(username);
CREATE TABLE IF NOT EXISTS sc_archive (id integer PRIMARY KEY CHECK(id=1),revision integer NOT NULL DEFAULT 1,cipher text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sc_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,at timestamptz NOT NULL DEFAULT now(),actor text NOT NULL,action text NOT NULL,detail text NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS sc_rate (bucket text PRIMARY KEY,n integer NOT NULL,until_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS sc_requests (username text NOT NULL,request_id text NOT NULL,revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(username,request_id));
ALTER TABLE sc_requests ADD COLUMN IF NOT EXISTS request_hash text;
CREATE TABLE IF NOT EXISTS sc_backup_runs (day date PRIMARY KEY,started_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,status text NOT NULL,object_key text,error text);
COMMIT;
