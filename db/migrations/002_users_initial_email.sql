-- Базы, созданные по ранней версии 001_initial, не содержат users.initial_email.
-- Миграция безопасна для новых баз: все шаги пропускаются, если колонка и ограничения уже есть.
ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_email text;
UPDATE users SET initial_email = lower(email) WHERE initial_email IS NULL;
ALTER TABLE users ALTER COLUMN initial_email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_initial_email_key' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_initial_email_key UNIQUE (initial_email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_initial_email_check' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_initial_email_check CHECK (initial_email = lower(initial_email));
  END IF;
END
$$;
