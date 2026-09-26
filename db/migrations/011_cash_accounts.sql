-- Cash has no bank: it gets its own identity, and it never funds transfers (it can still receive a withdrawal).
ALTER TABLE accounts DROP CONSTRAINT accounts_bank_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_bank_check CHECK (bank IN ('pko', 'credit-agricole', 'revolut', 'other', 'cash'));
ALTER TABLE account_balances DROP CONSTRAINT account_balances_bank_snapshot_check;
ALTER TABLE account_balances ADD CONSTRAINT account_balances_bank_snapshot_check
  CHECK (bank_snapshot IS NULL OR bank_snapshot IN ('pko', 'credit-agricole', 'revolut', 'other', 'cash'));

UPDATE accounts SET bank = 'cash', can_fund_transfers = false WHERE type = 'cash';
UPDATE account_balances SET bank_snapshot = 'cash' WHERE type_snapshot = 'cash';

INSERT INTO schema_migrations (name) VALUES ('011_cash_accounts') ON CONFLICT (name) DO NOTHING;
