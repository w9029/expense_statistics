CREATE TABLE account_to_users (
id uuid NOT NULL DEFAULT gen_random_uuid(),
account_id uuid NOT NULL  UNIQUE,
user_id uuid NOT NULL  UNIQUE,
role text NOT NULL DEFAULT "editor",
created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX idx_account_to_users_account_id ON account_to_users(account_id);
CREATE INDEX idx_account_to_users_user_id ON account_to_users(user_id);
