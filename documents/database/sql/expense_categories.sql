CREATE TABLE expense_categories (
id uuid NOT NULL DEFAULT gen_random_uuid(),
account_id uuid,
name text NOT NULL,
description text,
is_merge_category boolean NOT NULL DEFAULT FALSE,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
deleted_at timestamptz  DEFAULT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX idx_expense_categories_id ON expense_categories(id);
CREATE INDEX idx_expense_categories_account_id ON expense_categories(account_id);
