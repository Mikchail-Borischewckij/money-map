-- An income checked for this month: its amount and status are locked until unchecked, like a checked payment.
ALTER TABLE monthly_incomes ADD COLUMN IF NOT EXISTS is_checked boolean NOT NULL DEFAULT false;

-- Transfers already made this month. A made transfer keeps its amount; if the plan later needs more,
-- a new transfer for the rest appears next to it.
CREATE TABLE IF NOT EXISTS monthly_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_plan_id uuid NOT NULL REFERENCES monthly_plans(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES accounts(id),
  to_account_id uuid NOT NULL REFERENCES accounts(id),
  amount bigint NOT NULL CHECK (amount > 0),
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX IF NOT EXISTS monthly_transfers_plan_idx ON monthly_transfers(monthly_plan_id);
CREATE INDEX IF NOT EXISTS monthly_transfers_from_idx ON monthly_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS monthly_transfers_to_idx ON monthly_transfers(to_account_id);
ALTER TABLE monthly_transfers ENABLE ROW LEVEL SECURITY;

INSERT INTO schema_migrations (name) VALUES ('012_income_checks_and_done_transfers') ON CONFLICT (name) DO NOTHING;
