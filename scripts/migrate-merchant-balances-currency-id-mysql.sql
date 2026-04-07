-- Migrate legacy `merchant_balances.currency` (varchar) → `currency_id` FK to `currencies.id`.
-- Use when the table was created with a `currency` varchar column (ISO codes or numeric id strings).
-- Run AFTER `currencies` is populated. Back up the database first.
--
-- If this fails partway, restore from backup. If `currency_id` already exists, skip steps 1–3.

-- 1) Add nullable FK column
ALTER TABLE `merchant_balances`
  ADD COLUMN `currency_id` INT NULL AFTER `merchant_id`;

-- 2) Rows where `currency` is numeric (stored id)
UPDATE `merchant_balances` `mb`
SET `mb`.`currency_id` = CAST(`mb`.`currency` AS UNSIGNED)
WHERE `mb`.`currency` REGEXP '^[0-9]+$';

-- 3) Rows where `currency` is a 3-letter ISO code
UPDATE `merchant_balances` `mb`
INNER JOIN `currencies` `c` ON UPPER(TRIM(`c`.`code`)) = UPPER(TRIM(`mb`.`currency`))
SET `mb`.`currency_id` = `c`.`id`
WHERE `mb`.`currency_id` IS NULL;

-- Inspect orphans before continuing:
-- SELECT * FROM merchant_balances WHERE currency_id IS NULL;

-- 4) Replace column
ALTER TABLE `merchant_balances` DROP INDEX `UQ_merchant_bal_merchant_currency`;
ALTER TABLE `merchant_balances` DROP COLUMN `currency`;
ALTER TABLE `merchant_balances` MODIFY `currency_id` INT NOT NULL;
ALTER TABLE `merchant_balances` ADD UNIQUE KEY `UQ_merchant_bal_merchant_currency` (`merchant_id`, `currency_id`);
ALTER TABLE `merchant_balances`
  ADD CONSTRAINT `FK_merchant_balances_currency`
  FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT;
