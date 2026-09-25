-- A period can start on any day from 1 to 28 (1 = calendar month). The household setting applies to the open
-- period and later ones; each period keeps the start day it was planned with.
ALTER TABLE households ADD COLUMN period_start_day integer NOT NULL DEFAULT 1 CHECK (period_start_day BETWEEN 1 AND 28);
ALTER TABLE monthly_plans ADD COLUMN start_day integer NOT NULL DEFAULT 1 CHECK (start_day BETWEEN 1 AND 28);
