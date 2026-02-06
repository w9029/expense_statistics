CREATE TABLE auth_refresh_tokens (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL  UNIQUE,
refresh_token text NOT NULL,
expires_at timestamptz NOT NULL,
revoked_at timestamptz,
created_at timestamptz NOT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX idx_auth_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
CREATE INDEX idx_auth_refresh_tokens_expires_at ON auth_refresh_tokens(expires_at);
