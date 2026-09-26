-- Re-run bank recognition for accounts created before the icon picker was introduced.
UPDATE accounts SET bank = CASE
  WHEN lower(name) LIKE '%pko%' THEN 'pko'
  WHEN lower(name) LIKE '%credit agricole%' OR lower(name) LIKE '%agricole%' OR lower(name) LIKE '%креди%' THEN 'credit-agricole'
  WHEN lower(name) LIKE '%revolut%' OR lower(name) LIKE '%револют%' THEN 'revolut'
  ELSE bank
END
WHERE bank = 'other';

UPDATE account_balances b
SET bank_snapshot = a.bank
FROM accounts a
WHERE b.account_id = a.id AND (b.bank_snapshot IS NULL OR b.bank_snapshot = 'other');

INSERT INTO schema_migrations (name) VALUES ('010_backfill_account_banks') ON CONFLICT (name) DO NOTHING;
