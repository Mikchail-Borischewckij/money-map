-- Categories are either for payments or for incomes; the same settings tab lists both.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment', 'income'));

-- Starter income categories, once per household.
INSERT INTO categories (household_id, name, display_order, kind)
SELECT h.id, c.name, c.display_order, 'income'
FROM households h
CROSS JOIN (VALUES ('Зарплата', 10), ('800+ и пособия', 20), ('Другое', 30)) AS c(name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM categories e WHERE e.household_id = h.id AND e.kind = 'income' AND lower(e.name) = lower(c.name));

-- Regular incomes get a category like payments; the month keeps the category name as text.
ALTER TABLE recurring_incomes ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id);
ALTER TABLE income_template_versions ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id);
ALTER TABLE monthly_incomes ADD COLUMN IF NOT EXISTS category_snapshot text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS recurring_incomes_category_idx ON recurring_incomes(category_id);
CREATE INDEX IF NOT EXISTS income_template_versions_category_idx ON income_template_versions(category_id);

-- Existing incomes: "800+" goes to benefits, everything else is salary.
UPDATE recurring_incomes i SET category_id = c.id
FROM categories c
WHERE i.category_id IS NULL AND c.household_id = i.household_id AND c.kind = 'income'
  AND c.name = CASE WHEN i.name ILIKE '%800%' THEN '800+ и пособия' ELSE 'Зарплата' END;
UPDATE income_template_versions v SET category_id = i.category_id
FROM recurring_incomes i WHERE v.recurring_income_id = i.id AND v.category_id IS NULL;
UPDATE monthly_incomes m SET category_snapshot = c.name
FROM recurring_incomes i JOIN categories c ON c.id = i.category_id
WHERE m.recurring_income_id = i.id AND m.category_snapshot = '';

-- The NBP dollar rate a month is shown with; kept when the month is closed so its dollars never change afterwards.
ALTER TABLE monthly_plans ADD COLUMN IF NOT EXISTS usd_rate numeric(10, 4) CHECK (usd_rate IS NULL OR usd_rate > 0);
ALTER TABLE monthly_plans ADD COLUMN IF NOT EXISTS usd_rate_date date;

INSERT INTO schema_migrations (name) VALUES ('013_income_categories_and_usd_rate') ON CONFLICT (name) DO NOTHING;
