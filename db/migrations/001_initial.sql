CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  name text NOT NULL DEFAULT 'Family',
  currency text NOT NULL DEFAULT 'PLN' CHECK (currency = 'PLN'),
  time_zone text NOT NULL DEFAULT 'Europe/Warsaw',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO households (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  google_subject text NOT NULL UNIQUE,
  initial_email text NOT NULL UNIQUE CHECK (initial_email = lower(initial_email)),
  email text NOT NULL,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'current',
  display_order integer NOT NULL DEFAULT 0,
  can_fund_transfers boolean NOT NULL DEFAULT false,
  transfer_priority integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, id)
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recurring_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  name text NOT NULL,
  default_amount bigint NOT NULL CHECK (default_amount >= 0),
  account_id uuid NOT NULL REFERENCES accounts(id),
  expected_day integer CHECK (expected_day BETWEEN 1 AND 31),
  active_from date NOT NULL,
  active_to date,
  is_archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE TABLE recurring_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  name text NOT NULL,
  category_id uuid REFERENCES categories(id),
  default_amount bigint NOT NULL CHECK (default_amount >= 0),
  account_id uuid NOT NULL REFERENCES accounts(id),
  due_day integer CHECK (due_day BETWEEN 1 AND 31),
  active_from date NOT NULL,
  active_to date,
  is_archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE TABLE income_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_income_id uuid NOT NULL REFERENCES recurring_incomes(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  name text NOT NULL,
  default_amount bigint NOT NULL CHECK (default_amount >= 0),
  account_id uuid NOT NULL REFERENCES accounts(id),
  expected_day integer CHECK (expected_day BETWEEN 1 AND 31),
  UNIQUE (recurring_income_id, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE payment_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_payment_id uuid NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  name text NOT NULL,
  category_id uuid REFERENCES categories(id),
  default_amount bigint NOT NULL CHECK (default_amount >= 0),
  account_id uuid NOT NULL REFERENCES accounts(id),
  due_day integer CHECK (due_day BETWEEN 1 AND 31),
  UNIQUE (recurring_payment_id, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE monthly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  balance_date date,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Finalized')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, year, month)
);

CREATE TABLE account_balances (
  monthly_plan_id uuid NOT NULL REFERENCES monthly_plans(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id),
  amount bigint NOT NULL DEFAULT 0 CHECK (amount >= 0),
  balance_date date,
  is_confirmed boolean NOT NULL DEFAULT false,
  name_snapshot text NOT NULL,
  type_snapshot text NOT NULL,
  can_fund_transfers_snapshot boolean NOT NULL,
  transfer_priority_snapshot integer NOT NULL,
  PRIMARY KEY (monthly_plan_id, account_id)
);

CREATE TABLE monthly_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_plan_id uuid NOT NULL REFERENCES monthly_plans(id) ON DELETE CASCADE,
  recurring_income_id uuid REFERENCES recurring_incomes(id),
  name_snapshot text NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  account_id uuid NOT NULL REFERENCES accounts(id),
  expected_date date,
  is_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'Expected' CHECK (status IN ('Expected', 'IncludedInOpeningBalance', 'Excluded')),
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX monthly_incomes_plan_idx ON monthly_incomes(monthly_plan_id);

CREATE TABLE monthly_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_plan_id uuid NOT NULL REFERENCES monthly_plans(id) ON DELETE CASCADE,
  recurring_payment_id uuid REFERENCES recurring_payments(id),
  name_snapshot text NOT NULL,
  category_snapshot text NOT NULL DEFAULT '',
  amount bigint NOT NULL CHECK (amount >= 0),
  account_id uuid NOT NULL REFERENCES accounts(id),
  due_date date,
  is_enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX monthly_payments_plan_idx ON monthly_payments(monthly_plan_id);

CREATE TABLE allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_plan_id uuid NOT NULL REFERENCES monthly_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('living', 'savings', 'other')),
  amount bigint NOT NULL CHECK (amount >= 0),
  account_id uuid NOT NULL REFERENCES accounts(id),
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX allocations_plan_idx ON allocations(monthly_plan_id);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_version integer,
  new_version integer,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_household_time_idx ON audit_events(household_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Supabase exposes public-schema tables through PostgREST unless access is restricted.
-- The Next.js server connects with the database owner role; browser roles get no table access.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON households, users, sessions, accounts, categories, recurring_incomes,
      recurring_payments, income_template_versions, payment_template_versions,
      monthly_plans, account_balances, monthly_incomes, monthly_payments,
      allocations, audit_events, schema_migrations FROM anon;
    REVOKE ALL ON SEQUENCE audit_events_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON households, users, sessions, accounts, categories, recurring_incomes,
      recurring_payments, income_template_versions, payment_template_versions,
      monthly_plans, account_balances, monthly_incomes, monthly_payments,
      allocations, audit_events, schema_migrations FROM authenticated;
    REVOKE ALL ON SEQUENCE audit_events_id_seq FROM authenticated;
  END IF;
END $$;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

-- Keep CLI and Supabase-managed migrations in sync.
INSERT INTO schema_migrations (name) VALUES ('001_initial') ON CONFLICT (name) DO NOTHING;
