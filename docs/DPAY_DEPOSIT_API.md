# DPay deposit (bankQR / banktransfer / momo) documentation for GoldPay

GoldPay creates deposits using the **merchant-assigned provider**.
If your assigned provider is **dpay**, deposit calls ultimately hit one of:

- `https://pay.dpayvn.com/Index` (when `deposit_mode = "redirect"`)  <!-- matches your upstream spec -->
- `https://pay.dpayvn.com/index/deposit_json` (when `deposit_mode = "json"`; default)  
- `https://pay.dpayvn.com/index/deposit_cust` (when `deposit_mode = "cust"` / `"custom"`)

## 1. Merchant endpoint (GoldPay)

`POST /api/v1/funding/deposits`

Request body uses GoldPay fields (`amount`, `currency`, `idempotency_key`, `reference_id`, `metadata`, `sandbox`).
For DPay, you must set DPay channel fields inside `metadata`.

## 2. DPay channel selection

In `metadata`, set:

- `pay_type` (required) — DPay channel code:
  - `7` = bankQR
  - `9` = banktransfer
  - `8` = momo
  - `6` = MomoToBank
  - `5` = ZaloToBank
  - `4` = VietteToBank

Optional:

- `bank_code` — for `pay_type: 7` (bankQR) you can pass bank type code.
  - If `bank_code` is empty or the selected bank has no/insufficient assigned resources, DPay may return a failure (often `code=1022` with a message).
  - If `bank_code` is empty, DPay can automatically match available banks.

Recommended:

- Call `POST /api/v1/funding/bank-list` with the same `pay_type` and pick a returned bank `code`.

## 3. Other commonly used DPay metadata fields

- `merchant_order` (or `order` / `m_order`) — DPay order number.
  - If omitted, GoldPay uses `tx_<transactionId>`.
- `userinfo` (or `member_id`) — DPay member id.
- `user_ip` (or `ip`) — client IP.
- `extend` — can be empty; max length 190.
- `pay_date` — `YYYY-MM-DD HH:mm:ss` (optional; if missing GoldPay generates a +7 timezone value).
- `pay_notifyurl` — async notification url (optional).
- `pay_callbackurl` or `redirect_url` — sync redirect url (optional).
- `deposit_mode` / `mode`:
  - `"json"` (default) → `deposit_json`
  - `"cust"` / `"custom"` → `deposit_cust`
  - `"redirect"` → `/Index`

### 2.1 Redirect mode (`POST https://pay.dpayvn.com/Index`)

Use this when you want DPay to return a `payurl` that your cashier/front-end can redirect the user to.

GoldPay still expects the same logical fields; for DPay you will provide:

- `merchant_num`, `uid`
- `merchant_order`
- `coin`, `pay_date`, `extend`
- `pay_type`, optional `bank_code`
- `userinfo`, `user_ip`
- `pay_notifyurl` / `pay_callbackurl` (optional)
- `sign` (computed by GoldPay)

Typical successful DPay response contains:

- `code = "1"`
- `message = "SUCCESS"`
- `payurl`
- `date`

GoldPay mapping in this mode:

- `transaction.external_id`: best-effort from `serial_number` or your order id
- `transaction.payment.url` and `transaction.payment.payurl`: from DPay `payurl`

## 4. Response mapping (GoldPay)

On success, GoldPay returns a transaction object with:

- `status` (typically `processing`)
- `payment` object containing normalized DPay `pay_info` fields (e.g. QR string / bank/card info depending on channel).

If DPay returns `code != "1"`, GoldPay sets:

- `status: "failed"`
- `provider_error.code` and `provider_error.message` (DPay fields)
- `failure_reason` (same human readable message)

See `docs/DPAY_ERROR_CODES.md` for DPay `code/message` references (especially `1022`).

