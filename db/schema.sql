-- App tables. Better Auth's own tables (user, session, account, verification) are created by
-- scripts/migrate.mjs before this file runs. Every statement is idempotent.

CREATE TABLE IF NOT EXISTS licenses (
  id bigserial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'active', 'expired', 'revoked')),
  duration_days integer CHECK (duration_days > 0), -- NULL = lifetime; the clock starts on activation
  owner_discord_id text,
  developer_discord_id text,
  note text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by text
);
-- One live license per owner.
CREATE UNIQUE INDEX IF NOT EXISTS licenses_active_owner ON licenses (owner_discord_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS licenses_developer ON licenses (developer_discord_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id text PRIMARY KEY,
  permissions text[] NOT NULL DEFAULT '{}',
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_grants (
  discord_id text PRIMARY KEY,
  permissions text[] NOT NULL DEFAULT '{}',
  note text,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_attempts (
  id bigserial PRIMARY KEY,
  discord_id text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_attempts_recent ON license_attempts (discord_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor text NOT NULL, -- Discord ID, or "bot"
  action text NOT NULL,
  target text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_recent ON audit_log (created_at DESC);
