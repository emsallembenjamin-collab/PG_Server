-- Run this ONCE on MySQL if TypeORM synchronize fails with:
--   Cannot drop index 'UQ_merchant_bal_merchant_currency': needed in a foreign key constraint
--
-- InnoDB uses the leftmost prefix of the composite UNIQUE (merchant_id, currency) as the
-- supporting index for FK_merchant_balances_merchant. Dropping that unique index requires
-- a standalone index on merchant_id first.

CREATE INDEX `IDX_merchant_balances_merchant_id` ON `merchant_balances` (`merchant_id`);
