-- Multi-currency merchant ledger: one row per (merchant_id, currency).
-- Run once against existing databases that still store balances on `merchants`.
-- After running, deploy the application version that removes balance_* columns from `merchants`.

CREATE TABLE IF NOT EXISTS `merchant_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `merchant_id` int NOT NULL,
  `currency` varchar(3) NOT NULL,
  `balance_available` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance_locked` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_merchant_bal_merchant_currency` (`merchant_id`, `currency`),
  CONSTRAINT `FK_merchant_balances_merchant` FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `merchant_balances` (`merchant_id`, `currency`, `balance_available`, `balance_locked`, `created_at`, `updated_at`)
SELECT
  `id`,
  UPPER(COALESCE(NULLIF(TRIM(`balance_currency`), ''), 'USD')),
  COALESCE(`balance_available`, 0),
  COALESCE(`balance_locked`, 0),
  NOW(6),
  NOW(6)
FROM `merchants`
WHERE NOT EXISTS (
  SELECT 1 FROM `merchant_balances` b
  WHERE b.`merchant_id` = `merchants`.`id`
    AND b.`currency` = UPPER(COALESCE(NULLIF(TRIM(`balance_currency`), ''), 'USD'))
);

ALTER TABLE `merchants`
  DROP COLUMN `balance_currency`,
  DROP COLUMN `balance_available`,
  DROP COLUMN `balance_locked`;
