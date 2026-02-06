CREATE TABLE users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL  UNIQUE,
    password_hash text NOT NULL,
    name text NOT NULL,
    preferred_currency varchar(3) NOT NULL DEFAULT 'CNY',
    user_role text NOT NULL DEFAULT 'user',
    default_account_book_id uuid,
    is_active boolean NOT NULL DEFAULT True,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz  DEFAULT NULL,

    PRIMARY KEY (id)
);
CREATE INDEX idx_users_id ON users(id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_default_account_book_id ON users(default_account_book_id);
ALTER TABLE users ADD CONSTRAINT chk_users_preferred_currency 
    CHECK (preferred_currency ~ '^[A-Z]{3}$');
ALTER TABLE users ADD CONSTRAINT chk_users_user_role 
    CHECK (user_role IN ('user', 'admin'));


CREATE TABLE account_books (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    own_user_id uuid NOT NULL,
    base_currency varchar(3) NOT NULL DEFAULT 'CNY',
    description text NOT NULL,
    is_active boolean NOT NULL DEFAULT True,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz  DEFAULT NULL,

    PRIMARY KEY (id)
);
CREATE INDEX idx_account_books_id ON account_books(id);
CREATE INDEX idx_account_books_own_user_id ON account_books(own_user_id);
ALTER TABLE account_books ADD CONSTRAINT chk_account_books_base_currency 
    CHECK (base_currency ~ '^[A-Z]{3}$');


CREATE TABLE account_to_users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    account_role text NOT NULL DEFAULT 'editor',
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (id),
    CONSTRAINT cuq_account_user UNIQUE (account_book_id, user_id)
);
CREATE INDEX idx_account_to_users_account_book_id ON account_to_users(account_book_id);
CREATE INDEX idx_account_to_users_user_id ON account_to_users(user_id);
ALTER TABLE account_to_users ADD CONSTRAINT chk_account_to_users_account_role 
    CHECK (account_role IN ('viewer','editor','admin','owner'));


CREATE TABLE account_invitations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_book_id uuid NOT NULL,
    inviter_user_id uuid NOT NULL,
    account_role text NOT NULL DEFAULT 'editor',
    token text NOT NULL  UNIQUE,
    expires_at timestamptz NOT NULL,
    max_usage int2 NOT NULL,
    used_count int2 NOT NULL,
    status varchar(10) NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);
CREATE INDEX idx_account_invitations_account_book_id ON account_invitations(account_book_id);
CREATE INDEX idx_account_invitations_inviter_user_id ON account_invitations(inviter_user_id);
CREATE INDEX idx_account_invitations_expires_at ON account_invitations(expires_at);
ALTER TABLE account_invitations ADD CONSTRAINT chk_account_invitations_account_role 
    CHECK (account_role IN ('viewer','editor','admin','owner'));
ALTER TABLE account_invitations ADD CONSTRAINT chk_account_invitations_status 
    CHECK (status IN ('pending','accepted','revoked','expired'));


CREATE TABLE expense_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_book_id uuid,
    name text NOT NULL,
    description text,
    is_merge_category boolean NOT NULL DEFAULT False,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz  DEFAULT NULL,

    PRIMARY KEY (id)
);
CREATE INDEX idx_expense_categories_id ON expense_categories(id);
CREATE INDEX idx_expense_categories_account_book_id ON expense_categories(account_book_id);


CREATE TABLE expenses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    description text,
    original_amount numeric(12,2)	 NOT NULL,
    original_currency varchar(3) NOT NULL,
    exchange_rate_used numeric(12,6)	 NOT NULL,
    converted_amount numeric(12,2)	 NOT NULL,
    spent_at DATE NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz  DEFAULT NULL,

    PRIMARY KEY (id)
);
CREATE INDEX idx_expenses_id ON expenses(id);
CREATE INDEX idx_expenses_account_book_id ON expenses(account_book_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_parent_id ON expenses(parent_id);
ALTER TABLE expenses ADD CONSTRAINT chk_expenses_original_currency 
    CHECK (original_currency ~ '^[A-Z]{3}$');


CREATE TABLE budgets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_book_id uuid NOT NULL,
    category_id uuid,
    cycle_type text NOT NULL,
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
CREATE INDEX idx_budgets_account_book_id ON budgets(account_book_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);
ALTER TABLE budgets ADD CONSTRAINT chk_budgets_cycle_type 
    CHECK (cycle_type IN ('week', 'month'));
ALTER TABLE budgets ADD CONSTRAINT chk_budgets_currency 
    CHECK (currency ~ '^[A-Z]{3}$');


CREATE TABLE exchange_rates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    base_currency varchar(3) NOT NULL,
    target_currency varchar(3) NOT NULL,
    rate numeric(12,6) NOT NULL,
    date DATE NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);
CREATE INDEX idx_exchange_rates_base_currency ON exchange_rates(base_currency);
CREATE INDEX idx_exchange_rates_target_currency ON exchange_rates(target_currency);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(date);
ALTER TABLE exchange_rates ADD CONSTRAINT chk_exchange_rates_base_currency 
    CHECK (base_currency ~ '^[A-Z]{3}$');
ALTER TABLE exchange_rates ADD CONSTRAINT chk_exchange_rates_target_currency 
    CHECK (target_currency ~ '^[A-Z]{3}$');


CREATE TABLE notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    type varchar(30) NOT NULL,
    title text NOT NULL,
    message text,
    status varchar(10) NOT NULL DEFAULT 'unread',
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type 
    CHECK (type IN ('invitation','budget_exceeded','transaction_reminder','report','system'));
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_status 
    CHECK (status IN ('unread', 'read', 'archived', 'deleted'));


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


CREATE TABLE audit_log (
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
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_target_id ON audit_log(target_id);


ALTER TABLE users ADD CONSTRAINT fk_users_default_account_book_id 
	FOREIGN KEY (default_account_book_id) REFERENCES account_books(id) ON DELETE SET NULL;


ALTER TABLE account_books ADD CONSTRAINT fk_account_books_own_user_id 
	FOREIGN KEY (own_user_id) REFERENCES users(id) ON DELETE RESTRICT;


ALTER TABLE account_to_users ADD CONSTRAINT fk_account_to_users_account_book_id 
	FOREIGN KEY (account_book_id) REFERENCES account_books(id) ON DELETE CASCADE;
ALTER TABLE account_to_users ADD CONSTRAINT fk_account_to_users_user_id 
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


ALTER TABLE account_invitations ADD CONSTRAINT fk_account_invitations_account_book_id 
	FOREIGN KEY (account_book_id) REFERENCES account_books(id) ON DELETE CASCADE;
ALTER TABLE account_invitations ADD CONSTRAINT fk_account_invitations_inviter_user_id 
	FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE;


ALTER TABLE expense_categories ADD CONSTRAINT fk_expense_categories_account_book_id 
	FOREIGN KEY (account_book_id) REFERENCES account_books(id) ON DELETE CASCADE;


ALTER TABLE expenses ADD CONSTRAINT fk_expenses_account_book_id 
	FOREIGN KEY (account_book_id) REFERENCES account_books(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_user_id 
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_category_id 
	FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_parent_id 
	FOREIGN KEY (parent_id) REFERENCES expenses(id) ON DELETE CASCADE;


ALTER TABLE budgets ADD CONSTRAINT fk_budgets_account_book_id 
	FOREIGN KEY (account_book_id) REFERENCES account_books(id) ON DELETE CASCADE;
ALTER TABLE budgets ADD CONSTRAINT fk_budgets_category_id 
	FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE;


ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user_id 
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


ALTER TABLE auth_refresh_tokens ADD CONSTRAINT fk_auth_refresh_tokens_user_id 
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_user_id 
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;


