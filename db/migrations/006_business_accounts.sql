-- A business account sends everything above its own payments and a reserve to one personal account in a single transfer.
ALTER TABLE accounts
  ADD COLUMN sweep_to_account_id uuid REFERENCES accounts(id),
  ADD COLUMN keep_amount bigint NOT NULL DEFAULT 0 CHECK (keep_amount >= 0),
  ADD CONSTRAINT accounts_sweep_not_self CHECK (sweep_to_account_id IS NULL OR sweep_to_account_id <> id);

-- Closed months keep the business settings they were closed with.
ALTER TABLE account_balances
  ADD COLUMN sweep_to_snapshot uuid,
  ADD COLUMN keep_amount_snapshot bigint CHECK (keep_amount_snapshot >= 0);

-- A regular payment whose amount changes month to month (taxes): a new month takes the settings amount as an estimate to check.
ALTER TABLE recurring_payments ADD COLUMN amount_varies boolean NOT NULL DEFAULT false;
ALTER TABLE monthly_payments ADD COLUMN amount_pending boolean NOT NULL DEFAULT false;

-- Living money is now whatever is left, so the open month drops its "living" amount. Closed months keep theirs.
DELETE FROM allocations a USING monthly_plans p WHERE a.monthly_plan_id = p.id AND p.status = 'Draft' AND a.type = 'living';
