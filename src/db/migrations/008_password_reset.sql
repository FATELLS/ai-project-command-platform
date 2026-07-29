ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0 CHECK (must_reset_password IN (0, 1));
