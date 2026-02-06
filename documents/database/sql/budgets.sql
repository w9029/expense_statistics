CREATE TABLE budgets (
id uuid NOT NULL DEFAULT gen_random_uuid(),
account_id uuid NOT NULL,
category_id uuid,
cycle text NOT NULL,
cycle_start_day int NOT NULL DEFAULT 1,
amount numeric(12,2)	 NOT NULL,
currency varchar(3) NOT NULL,
is_active boolean NOT NULL DEFAULT TRUE,
start_date timestamptz NOT NULL,
end_date timestamptz NOT NULL,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX idx_budgets_account_id ON budgets(account_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);
