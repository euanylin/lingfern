-- Retain consumed confirmations until expiry to fence revocation races.
ALTER TABLE binding_intents ADD COLUMN consumed INTEGER NOT NULL DEFAULT 0;
