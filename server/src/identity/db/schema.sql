CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  cnic VARCHAR(15) NOT NULL,
  dob DATE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver')),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_image TEXT NOT NULL,
  cnic_front TEXT NOT NULL,
  cnic_back TEXT NOT NULL,
  password_reset_token_hash TEXT,
  password_reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phone, role),
  UNIQUE (cnic, role)
);

CREATE TABLE IF NOT EXISTS drivers (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(100) NOT NULL,
  license_image TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_verification_attempts (
  identifier TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_cnic_role_unique'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_cnic_role_unique UNIQUE (cnic, role);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_phone_role_unique'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_phone_role_unique UNIQUE (phone, role);
  END IF;
END$$;
