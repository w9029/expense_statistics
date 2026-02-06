CREATE TABLE exchange_rates (
id uuid NOT NULL DEFAULT gen_random_uuid(),
base_currency varchar(3) NOT NULL,
target_currency varchar(3) NOT NULL,
rate numeric(12,6) NOT NULL,
date timestamptz NOT NULL,
created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX idx_exchange_rates_base_currency ON exchange_rates(base_currency);
CREATE INDEX idx_exchange_rates_target_currency ON exchange_rates(target_currency);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(date);
