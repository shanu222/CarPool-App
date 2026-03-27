import crypto from "node:crypto";
import { query, withTransaction } from "../db/postgres.js";

export const ensureIdentitySchema = async () => {
  await query(`
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
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS drivers (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      license_number VARCHAR(100) NOT NULL,
      license_image TEXT NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS identity_verification_attempts (
      identifier TEXT PRIMARY KEY,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      blocked_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
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
  `);

  await query(`
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
  `);
};

export const getUserByPhoneAndRole = async (phone, role) => {
  const result = await query(
    `
      SELECT id, name, phone, cnic, dob, role, password_hash, is_verified, profile_image, cnic_front, cnic_back
      FROM users
      WHERE phone = $1 AND role = $2
      LIMIT 1
    `,
    [phone, role]
  );

  return result.rows[0] || null;
};

export const getUserByIdentity = async ({ phone, cnic, dob, role }) => {
  const result = await query(
    `
      SELECT id, name, phone, cnic, dob, role, password_hash, is_verified
      FROM users
      WHERE phone = $1 AND cnic = $2 AND dob = $3 AND role = $4
      LIMIT 1
    `,
    [phone, cnic, dob, role]
  );

  return result.rows[0] || null;
};

export const findExistingAccountForRole = async ({ phone, cnic, role }) => {
  const result = await query(
    `
      SELECT id
      FROM users
      WHERE role = $1
        AND (cnic = $2 OR phone = $3)
      LIMIT 1
    `,
    [role, cnic, phone]
  );

  return result.rowCount > 0;
};

export const createVerifiedUser = async ({
  name,
  phone,
  cnic,
  dob,
  passwordHash,
  role,
  profileImage,
  cnicFront,
  cnicBack,
  licenseNumber,
  licenseImage,
}) => {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM users WHERE (phone = $1 OR cnic = $2) AND role = $3 LIMIT 1`,
      [phone, cnic, role]
    );

    if (existing.rowCount > 0) {
      const conflict = new Error(`Account already exists as ${role}. Please login.`);
      conflict.statusCode = 409;
      throw conflict;
    }

    const insertUser = await client.query(
      `
        INSERT INTO users (name, phone, cnic, dob, password_hash, role, is_verified, profile_image, cnic_front, cnic_back)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9)
        RETURNING id, name, phone, cnic, dob, role, is_verified
      `,
      [name, phone, cnic, dob, passwordHash, role, profileImage, cnicFront, cnicBack]
    );

    const user = insertUser.rows[0];

    if (role === "driver") {
      await client.query(
        `INSERT INTO drivers (user_id, license_number, license_image) VALUES ($1, $2, $3)`,
        [user.id, licenseNumber, licenseImage]
      );
    }

    return user;
  });
};

export const consumeVerificationAttempt = async ({ identifier, maxAttempts, blockMinutes }) => {
  const now = new Date();

  const result = await query(
    `SELECT identifier, attempt_count, blocked_until FROM identity_verification_attempts WHERE identifier = $1 LIMIT 1`,
    [identifier]
  );

  if (result.rowCount === 0) {
    await query(
      `INSERT INTO identity_verification_attempts (identifier, attempt_count, blocked_until, updated_at)
       VALUES ($1, 1, NULL, NOW())`,
      [identifier]
    );
    return { blocked: false, attemptsUsed: 1 };
  }

  const row = result.rows[0];
  const blockedUntil = row.blocked_until ? new Date(row.blocked_until) : null;

  if (blockedUntil && blockedUntil > now) {
    return { blocked: true, blockedUntil };
  }

  const nextCount = Number(row.attempt_count || 0) + 1;

  if (nextCount >= maxAttempts) {
    const until = new Date(Date.now() + blockMinutes * 60 * 1000);
    await query(
      `UPDATE identity_verification_attempts
       SET attempt_count = 0, blocked_until = $2, updated_at = NOW()
       WHERE identifier = $1`,
      [identifier, until.toISOString()]
    );

    return { blocked: true, blockedUntil: until };
  }

  await query(
    `UPDATE identity_verification_attempts
     SET attempt_count = $2, blocked_until = NULL, updated_at = NOW()
     WHERE identifier = $1`,
    [identifier, nextCount]
  );

  return { blocked: false, attemptsUsed: nextCount };
};

export const clearVerificationAttempts = async (identifier) => {
  await query(`DELETE FROM identity_verification_attempts WHERE identifier = $1`, [identifier]);
};

export const saveResetToken = async ({ userId, token, expiryMinutes }) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  await query(
    `
      UPDATE users
      SET password_reset_token_hash = $2, password_reset_token_expiry = $3, updated_at = NOW()
      WHERE id = $1
    `,
    [userId, hashedToken, expiry]
  );
};

export const updatePasswordWithResetToken = async ({ phone, role, token, passwordHash }) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const result = await query(
    `
      UPDATE users
      SET password_hash = $4,
          password_reset_token_hash = NULL,
          password_reset_token_expiry = NULL,
          updated_at = NOW()
      WHERE phone = $1
        AND role = $2
        AND password_reset_token_hash = $3
        AND password_reset_token_expiry IS NOT NULL
        AND password_reset_token_expiry > NOW()
      RETURNING id
    `,
    [phone, role, hashedToken, passwordHash]
  );

  return result.rowCount > 0;
};
