-- Adds platform fee configuration + per-transaction fee columns.
-- Run this once on production DB.

CREATE TABLE IF NOT EXISTS system_fee_settings (
  id INT NOT NULL AUTO_INCREMENT,
  deposit_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  withdrawal_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  third_party_deposit_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  third_party_withdrawal_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE system_fee_settings
  ADD COLUMN IF NOT EXISTS third_party_deposit_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS third_party_withdrawal_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00;

INSERT INTO system_fee_settings (
  id,
  deposit_fee_percentage,
  withdrawal_fee_percentage,
  third_party_deposit_fee_percentage,
  third_party_withdrawal_fee_percentage
)
VALUES (1, 1.00, 1.00, 0.00, 0.00)
ON DUPLICATE KEY UPDATE
  deposit_fee_percentage = VALUES(deposit_fee_percentage),
  withdrawal_fee_percentage = VALUES(withdrawal_fee_percentage),
  third_party_deposit_fee_percentage = VALUES(third_party_deposit_fee_percentage),
  third_party_withdrawal_fee_percentage = VALUES(third_party_withdrawal_fee_percentage);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS system_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS system_fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS third_party_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS third_party_fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS merchant_settlement_amount DECIMAL(15,2) NULL;

UPDATE transactions
SET
  total_fee_amount = system_fee_amount + third_party_fee_amount,
  merchant_settlement_amount = CASE
    WHEN merchant_settlement_amount IS NOT NULL THEN merchant_settlement_amount
    WHEN type = 'deposit' THEN amount - (system_fee_amount + third_party_fee_amount)
    ELSE amount + (system_fee_amount + third_party_fee_amount)
  END
WHERE merchant_settlement_amount IS NULL;
