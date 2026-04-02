# DPay provider on GoldPay server — setup guide

DPay is implemented **inside** the GoldPay NestJS app (`DpayService`). There is no separate DPay process to start. You:

1. Set **environment variables** for DPay API credentials and URLs.
2. Create a **provider** row in GoldPay with `name = dpay`.
3. **Restart** the GoldPay server after env changes.
4. **Assign** that provider to each merchant that should use DPay.

---

## 1. Provider record (database / admin UI)

GoldPay routes traffic by the provider’s **`name`** field. The code registers the integration under the key **`dpay`** (lowercase).

- In **Providers** → **New Provider** (or `POST /api/v1/providers` as admin):
  - **Name:** `dpay` (required; must match exactly)
  - **Display name:** e.g. `DPay`
  - **Status:** `active`

Until this row exists, you cannot assign “DPay” to merchants in a way the runtime understands.

### “Internal server error” when saving New Provider

Common causes:

1. **Max amount too large for the database column (most likely)**  
   Older schemas store `min_amount` / `max_amount` as `DECIMAL(15,2)`. That caps around **9,999,999,999,999.99** (13 integer digits). Values like **100,000,000,000,000** overflow and MySQL returns an error → the API may show **Internal server error**.

   **Fix (pick one):**
   - Use a **smaller Max amount** that fits in 13 integer digits (e.g. `9999999999999.99`), **or**
   - Widen the columns (recommended for large VND limits) and restart GoldPay:

   ```sql
   ALTER TABLE providers
     MODIFY min_amount DECIMAL(20,2) NULL,
     MODIFY max_amount DECIMAL(20,2) NULL;
   ```

   In **development**, TypeORM `synchronize` can apply the wider columns from the current `Provider` entity after you pull the latest code and restart.

2. **Duplicate provider name**  
   `name` is unique. If `dpay` already exists, create will fail (unique constraint). Use the existing row or choose another name (not recommended for DPay — the code expects `dpay`).

---

## 2. Environment variables

Set these on the host where GoldPay runs (`.env`, PM2 ecosystem, Docker, etc.), then **restart** GoldPay.

### Required (from your DPay merchant dashboard)

| Variable | Description |
|----------|-------------|
| `DPAY_UID` | DPay UID |
| `DPAY_MERCHANT_NUM` | DPay merchant number |
| `DPAY_SECRET` | Signing secret (alias: `DPAY_API_SECRET`) |

### Strongly recommended (webhook URL construction)

GoldPay builds callback URLs like:

`{BACKEND_URL or APP_URL or FRONTEND_URL}/api/v1/webhooks/providers/dpay/callback`

| Variable | Description |
|----------|-------------|
| `BACKEND_URL` | Preferred public base URL of this API |
| `APP_URL` | Fallback if `BACKEND_URL` is unset |
| `FRONTEND_URL` | Fallback if the above are unset |

Use a **public HTTPS** base URL in production so DPay can POST callbacks.

### Optional — DPay hosts (defaults exist in code)

Override only if DPay gave you different endpoints.

| Variable | Typical use |
|----------|-------------|
| `DPAY_BASE_URL` | Deposit / payment host (default `https://pay.dpayvn.com`) |
| `DPAY_PAYOUT_BASE_URL` | Payout host (default `https://payment.dpayvn.com`) |
| `DPAY_LOOK_BASE_URL` | Balance inquiry `Look/get_coin` (default `https://payment.dpayvn.com`) |
| `DPAY_PAYOUT_INQUIRY_LOOK_BASE_URL` | Payout inquiry `Look/pay_order` (default `https://pay.dpayvn.com`) |

### Optional — signing (only if your DPay project uses non-default rules)

| Variable | Notes |
|----------|--------|
| `DPAY_SIGN_MODE` | e.g. `key_value` (default) |
| `DPAY_SIGN_SECRET_POSITION` | `append` (default) or `prepend` |
| `DPAY_SIGN_ALGORITHM` | `md5` (default), `sha1`, `sha256` |
| `DPAY_SIGN_OUTPUT_CASE` | `upper` (default) or `lower` |
| `DPAY_SIGN_FIELDS` | Comma-separated field list if needed |
| `DPAY_DEFAULT_PAY_TYPE` | Default channel if metadata omits `pay_type` |
| `DPAY_DEFAULT_USER_IP` | Default `user_ip` if metadata omits it |

See also: `.env.example` in the GoldPay repo for commented examples.

---

## 3. Assign DPay to a merchant

Each merchant has at most **one** assigned provider (`merchant.provider_id`).

- **Admin API:** `POST /api/v1/merchants/{id}/provider` with body `{ "providerId": <id of dpay row> }`
- Or use your **GoldPay admin UI** merchant screen, if it exposes provider assignment.

Merchants call GoldPay with their **API key**; GoldPay uses the **assigned** provider for `/funding/*` and generic transaction endpoints.

---

## 4. Verification

With a merchant assigned to `dpay` and env loaded:

1. **Bank list** (merchant key):  
   `POST /api/v1/funding/bank-list`  
   Body: `{ "pay_type": 7 }` (or another channel you use)

2. **Deposit:**  
   `POST /api/v1/funding/deposits`  
   Include `amount`, `metadata.pay_type`, optional `metadata.bank_code` (see `docs/DPAY_DEPOSIT_API.md`).

3. **Withdrawal:**  
   `POST /api/v1/funding/withdrawals`  
   Include `amount` and DPay payout metadata (bank / account fields per your integration).

4. **Callbacks:**  
   Confirm DPay can reach your public URL:  
   `POST .../api/v1/webhooks/providers/dpay/callback`

---

## 5. Common issues

| Symptom | What to check |
|---------|----------------|
| “Provider service not found” / wrong integration | Provider **`name`** must be exactly `dpay`. |
| Still using old credentials | Restart GoldPay after editing `.env`. |
| Bank list / deposit fails with auth or signature errors | `DPAY_SECRET`, `DPAY_UID`, `DPAY_MERCHANT_NUM`; signing env if non-default. |
| No callbacks | `BACKEND_URL` / public URL, HTTPS, firewall, DPay whitelist. |
| Merchant cannot use DPay features | `merchant.provider_id` must point at the `dpay` provider row. |

---

## 6. Related docs

- Deposit fields and channels: `docs/DPAY_DEPOSIT_API.md`
- Merchant-facing API overview: `docs/MERCHANT_API.md`
- Error codes: `docs/DPAY_ERROR_CODES.md`
- Payout callback: `docs/DPAY_PAYOUT_CALLBACK.md`
- Deposit callback: `docs/DPAY_DEPOSIT_CALLBACK.md`
