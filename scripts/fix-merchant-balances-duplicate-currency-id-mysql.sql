-- =============================================================================
-- Fix merchant_balances before CREATE UNIQUE INDEX (merchant_id, currency_id)
-- Error: Duplicate entry '4-0' for key 'merchant_balances.UQ_merchant_bal_merchant_currency'
--
-- BACK UP `merchant_balances` FIRST:
--   mysqldump -u... -p pg_service merchant_balances > merchant_balances_backup.sql
-- =============================================================================

USE pg_service;

-- ---------------------------------------------------------------------------
-- 1) Inspect bad / duplicate rows
-- ---------------------------------------------------------------------------
SELECT merchant_id, currency_id, COUNT(*) AS row_count,
       GROUP_CONCAT(id ORDER BY id) AS balance_row_ids,
       SUM(CAST(balance_available AS DECIMAL(15,2))) AS sum_avail,
       SUM(CAST(balance_locked AS DECIMAL(15,2))) AS sum_locked
FROM merchant_balances
GROUP BY merchant_id, currency_id
HAVING COUNT(*) > 1 OR currency_id IS NULL OR currency_id = 0;

-- Optional: list raw rows for merchant_id = 4
-- SELECT * FROM merchant_balances WHERE merchant_id = 4 ORDER BY id;

-- ---------------------------------------------------------------------------
-- 2) If legacy column `currency` (varchar) STILL EXISTS: map ISO code → currency_id
--    Skip this block if the column was already dropped.
-- ---------------------------------------------------------------------------
-- UPDATE merchant_balances mb
-- INNER JOIN currencies c ON UPPER(TRIM(c.code)) = UPPER(TRIM(mb.currency))
-- SET mb.currency_id = c.id
-- WHERE mb.currency_id IS NULL OR mb.currency_id = 0;

-- ---------------------------------------------------------------------------
-- 3) If legacy `currency` stored numeric id as string (e.g. '1' = USD row in currencies)
-- ---------------------------------------------------------------------------
-- UPDATE merchant_balances mb
-- SET mb.currency_id = CAST(mb.currency AS UNSIGNED)
-- WHERE (mb.currency_id IS NULL OR mb.currency_id = 0)
--   AND mb.currency REGEXP '^[0-9]+$';

-- ---------------------------------------------------------------------------
-- 4) If you have NO legacy `currency` column and only zeros: assign default USD
--    (adjust if your default should be another code)
-- ---------------------------------------------------------------------------
UPDATE merchant_balances mb
INNER JOIN currencies c ON c.code = 'USD'
SET mb.currency_id = c.id
WHERE mb.currency_id IS NULL OR mb.currency_id = 0;

-- If the UPDATE above creates NEW duplicates (same merchant + USD twice), run step 5.

-- ---------------------------------------------------------------------------
-- 5) Merge duplicate (merchant_id, currency_id): keep smallest `id`, sum balances
-- ---------------------------------------------------------------------------
UPDATE merchant_balances b
INNER JOIN (
  SELECT
    merchant_id,
    currency_id,
    MIN(id) AS keep_id,
    SUM(CAST(balance_available AS DECIMAL(15,2))) AS sum_avail,
    SUM(CAST(balance_locked AS DECIMAL(15,2))) AS sum_locked
  FROM merchant_balances
  GROUP BY merchant_id, currency_id
  HAVING COUNT(*) > 1
) x ON b.id = x.keep_id
SET
  b.balance_available = CAST(ROUND(x.sum_avail, 2) AS CHAR),
  b.balance_locked = CAST(ROUND(x.sum_locked, 2) AS CHAR);

DELETE b
FROM merchant_balances b
INNER JOIN (
  SELECT merchant_id, currency_id, MIN(id) AS keep_id
  FROM merchant_balances
  GROUP BY merchant_id, currency_id
) x ON b.merchant_id = x.merchant_id
   AND b.currency_id = x.currency_id
   AND b.id <> x.keep_id;

-- ---------------------------------------------------------------------------
-- 6) Verify: must return 0 rows
-- ---------------------------------------------------------------------------
SELECT merchant_id, currency_id, COUNT(*) AS c
FROM merchant_balances
GROUP BY merchant_id, currency_id
HAVING c > 1;

SELECT COUNT(*) AS rows_with_bad_fk FROM merchant_balances WHERE currency_id IS NULL OR currency_id = 0;

-- Then restart the app (TypeORM can CREATE UNIQUE INDEX ...).
