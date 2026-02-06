CREATE TABLE auth_refresh_tokens (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
action text NOT NULL,
target_type text,
target_id uuid,
detail jsonb,
ip_address varchar(45) NOT NULL,
user_agent text NOT NULL,
created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX idx_auth_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
CREATE INDEX idx_auth_refresh_tokens_target_id ON auth_refresh_tokens(target_id);
