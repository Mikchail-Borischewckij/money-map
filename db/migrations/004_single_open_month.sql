-- Only the current month is planned. Months created before this rule held test data only and are removed;
-- accounts, recurring items and categories stay.
DELETE FROM audit_events WHERE entity_type IN ('MonthlyPlan', 'MonthlyPayment', 'MonthlyIncome');
DELETE FROM monthly_plans;

-- At most one open (Draft) month per household.
CREATE UNIQUE INDEX monthly_plans_one_open_idx ON monthly_plans (household_id) WHERE status = 'Draft';

-- Starter categories; existing ones with the same name are kept as they are.
INSERT INTO categories (household_id, name, display_order)
SELECT h.id, c.name, c.display_order
FROM households h
CROSS JOIN (VALUES
  ('Жильё', 10),
  ('Коммунальные', 20),
  ('Связь', 30),
  ('Садик и школа', 40),
  ('Питание детей', 50),
  ('Занятия', 60),
  ('Спорт', 70),
  ('Транспорт', 80),
  ('Еда и доставка', 90),
  ('Красота', 100),
  ('Личные расходы', 110),
  ('Прочее', 120)
) AS c(name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM categories e WHERE e.household_id = h.id AND lower(e.name) = lower(c.name));
