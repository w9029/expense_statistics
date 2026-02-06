CREATE TABLE account_invitations (
id uuid NOT NULL DEFAULT gen_random_uuid(),
account_id uuid NOT NULL,
inviter_user_id uuid NOT NULL,
role text NOT NULL DEFAULT "editor",
token text NOT NULL  UNIQUE,
expires_at timestamptz NOT NULL,
max_usage int2 NOT NULL,
used_count int2 NOT NULL,
status varchar(10) NOT NULL DEFAULT "pending",
created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX idx_account_invitations_account_id ON account_invitations(account_id);
CREATE INDEX idx_account_invitations_inviter_user_id ON account_invitations(inviter_user_id);
CREATE INDEX idx_account_invitations_expires_at ON account_invitations(expires_at);
