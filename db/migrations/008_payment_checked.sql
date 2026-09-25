-- A payment whose amount the owner has checked for this month: the amount is locked until unchecked,
-- and settings changes no longer overwrite it.
ALTER TABLE monthly_payments ADD COLUMN IF NOT EXISTS is_checked boolean NOT NULL DEFAULT false;
