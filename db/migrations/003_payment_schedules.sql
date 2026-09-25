-- Recurring payments are either monthly (fixed amount, optional day) or weekly
-- (price per occurrence × number of selected ISO weekdays in the month).
ALTER TABLE recurring_payments
  ADD COLUMN schedule text NOT NULL DEFAULT 'monthly',
  ADD COLUMN weekdays integer[],
  ADD CONSTRAINT recurring_payments_schedule_check CHECK (
    (schedule = 'monthly' AND weekdays IS NULL)
    OR (schedule = 'weekly' AND weekdays IS NOT NULL AND cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]));

ALTER TABLE payment_template_versions
  ADD COLUMN schedule text NOT NULL DEFAULT 'monthly',
  ADD COLUMN weekdays integer[],
  ADD CONSTRAINT payment_template_versions_schedule_check CHECK (
    (schedule = 'monthly' AND weekdays IS NULL)
    OR (schedule = 'weekly' AND weekdays IS NOT NULL AND cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]));

-- Monthly snapshot: unit_price and quantity are set together; amount then equals their product.
ALTER TABLE monthly_payments
  ADD COLUMN schedule_snapshot text CHECK (schedule_snapshot IN ('monthly', 'weekly')),
  ADD COLUMN weekdays_snapshot integer[],
  ADD COLUMN unit_price bigint CHECK (unit_price >= 0),
  ADD COLUMN quantity integer CHECK (quantity >= 0),
  ADD COLUMN exclusion_reason text NOT NULL DEFAULT '',
  ADD CONSTRAINT monthly_payments_unit_check CHECK (
    (unit_price IS NULL AND quantity IS NULL)
    OR (unit_price IS NOT NULL AND quantity IS NOT NULL AND amount = unit_price * quantity));
