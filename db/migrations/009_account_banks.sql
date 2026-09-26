ALTER TABLE accounts ADD COLUMN bank text;

UPDATE accounts SET bank = CASE
  WHEN lower(name) LIKE '%pko%' THEN 'pko'
  WHEN lower(name) LIKE '%agricole%' THEN 'credit-agricole'
  WHEN lower(name) LIKE '%revolut%' THEN 'revolut'
  ELSE 'other'
END;

ALTER TABLE accounts
  ALTER COLUMN bank SET DEFAULT 'other',
  ALTER COLUMN bank SET NOT NULL,
  ADD CONSTRAINT accounts_bank_check CHECK (bank IN ('pko', 'credit-agricole', 'revolut', 'other'));

ALTER TABLE account_balances ADD COLUMN bank_snapshot text;
UPDATE account_balances b SET bank_snapshot = a.bank FROM accounts a WHERE a.id = b.account_id;
ALTER TABLE account_balances ADD CONSTRAINT account_balances_bank_snapshot_check
  CHECK (bank_snapshot IS NULL OR bank_snapshot IN ('pko', 'credit-agricole', 'revolut', 'other'));

INSERT INTO schema_migrations (name) VALUES ('009_account_banks') ON CONFLICT (name) DO NOTHING;
