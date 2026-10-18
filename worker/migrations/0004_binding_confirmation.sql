-- Retain a consumed confirmation until expiry so revocation can fence in-flight work.
ALTER TABLE binding_intents ADD COLUMN consumed INTEGER NOT NULL DEFAULT 0;
