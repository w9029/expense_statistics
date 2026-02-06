CREATE TABLE expenses (
id uuid NOT NULL DEFAULT gen_random_uuid(),
account_id uuid NOT NULL,
user_id uuid NOT NULL,
category_id uuid NOT NULL DEFAULT FALSE,
parent_id uuid  DEFAULT now(),
name text NOT NULL,
description text,
original_amount numeric(12,2)	 NOT NULL,
original_currency varchar(3) NOT NULL,
exchange_rate_used numeric(12,6)	 NOT NULL,
converted_amount numeric(12,2)	 NOT NULL,
spent_at timestamptz NOT NULL,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
deleted_at timestamptz  DEFAULT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX idx_expenses_id ON expenses(id);
CREATE INDEX idx_expenses_account_id ON expenses(account_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_parent_id ON expenses(parent_id);
