-- A regular income whose amount changes from month to month. A new month takes the settings amount as an estimate
-- and marks it to be checked; the month stays preliminary until the amount is checked or the money has arrived.
ALTER TABLE recurring_incomes ADD COLUMN amount_varies boolean NOT NULL DEFAULT false;
ALTER TABLE monthly_incomes ADD COLUMN amount_pending boolean NOT NULL DEFAULT false;
