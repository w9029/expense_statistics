CREATE TABLE account_books (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
own_user_id uuid NOT NULL,
base_currency varchar(3) NOT NULL DEFAULT "CNY",
description text NOT NULL,
is_active boolean NOT NULL DEFAULT TRUE,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
deleted_at timestamptz  DEFAULT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX idx_account_books_id ON account_books(id);
CREATE INDEX idx_account_books_own_user_id ON account_books(own_user_id);
