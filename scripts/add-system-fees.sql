-- Adds platform fee configuration + per-transaction fee columns.
-- Run this once on production DB.

CREATE TABLE IF NOT EXISTS system_fee_settings (
  id INT NOT NULL AUTO_INCREMENT,
  deposit_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  withdrawal_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO system_fee_settings (id, deposit_fee_percentage, withdrawal_fee_percentage)
VALUES (1, 1.00, 1.00)
ON DUPLICATE KEY UPDATE
  deposit_fee_percentage = VALUES(deposit_fee_percentage),
  withdrawal_fee_percentage = VALUES(withdrawal_fee_percentage);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS system_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS system_fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS merchant_settlement_amount DECIMAL(15,2) NULL;

UPDATE transactions
SET merchant_settlement_amount = amount
WHERE merchant_settlement_amount IS NULL;
