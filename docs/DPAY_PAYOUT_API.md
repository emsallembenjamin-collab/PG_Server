# DPay payout request (`payment` API)

GoldPay uses this upstream request inside **withdrawal** flow when the merchant is assigned the **DPay** provider.

## 1. Upstream (DPay) endpoint

| Item | Value |
|------|-------|
| URL | `https://payment.dpayvn.com/payment` (override with `DPAY_PAYOUT_BASE_URL`) |
| Method | `POST` |
| Content-Type | `application/x-www-form-urlencoded;charset=UTF-8` |

## 2. Required form fields (GoldPay mapping)

DPay requires signing and the payout bank details.

| DPay field | Required | Source in GoldPay |
|------------|----------|--------------------|
| `uid` | yes | `metadata.uid` or env `DPAY_UID` |
| `merchant_num` | yes | `metadata.merchant_num` or env `DPAY_MERCHANT_NUM` |
| `order` | yes | withdrawal `metadata.order` / `metadata.merchant_order` / `metadata.m_order` (fallback: `tx_<transactionId>`) |
| `coin` | yes | merchant withdrawal `amount` (rounded) |
| `userinfo` | yes | `metadata.userinfo` or `metadata.member_id` (fallback: `order`) |
| `target_bank` | yes | `metadata.target_bank` or `metadata.target_bank_number` |
| `bank_name` | yes | Vietnam Napas/BIN sent to DPay: GoldPay resolves `vietnam_bank_codes` when metadata matches a **code** (e.g. `970436`) or **abbreviation** (e.g. `VCB`) via `vietnam_bank_code`, `vietnam_bank_bin`, `bank_code`, then `bank_name`. If no row matches, the raw `metadata.bank_name` / `bank_code` is used (e.g. DPay `bank_list` channel code). See `GET /api/v1/banks/vietnam-codes`. |
| `target_bank_user` | yes | `metadata.target_bank_user` or `metadata.bank_user` |
| `extend` | yes | `metadata.extend` (default: `""`; for India put IFSC) |
| `order_date` | yes | `metadata.order_date` formatted as `YYYY-MM-DD HH:mm:ss` (if omitted, GoldPay generates current time in +7 timezone) |
| `notifyurl` | no | `metadata.notifyurl` or `metadata.pay_notifyurl` (if omitted, GoldPay sets it to GoldPay payout callback URL) |
| `user_ip` | yes | `metadata.user_ip` or `metadata.ip` (fallback: env `DPAY_DEFAULT_USER_IP`, default `127.0.0.1`) |
| `sign` | yes | computed by GoldPay using `DPAY_SIGN_*` + `DPAY_SECRET` |

## 3. Signature

GoldPay computes `sign` using the same signing rules as other DPay calls:

- `DPAY_SIGN_MODE` (`key_value` / `json` / `values_only`)
- `DPAY_SIGN_SECRET_POSITION` (`append` / `prepend`)
- `DPAY_SIGN_ALGORITHM` (`md5` / `sha1` / `sha256`)
- `DPAY_SIGN_OUTPUT_CASE` (upper/lower)

## 4. DPay response (what GoldPay expects)

DPay returns JSON like:

```json
{ "code": "1", "message": "SUCCESS" }
```

- Success: `code === "1"` (string `1`) => GoldPay returns `success: true`
- Failure: anything else => GoldPay returns `success: false` and surfaces `provider_error.code` + `provider_error.message`.

See `docs/DPAY_ERROR_CODES.md` for the `code/message` meaning.

## 5. GoldPay merchant endpoint (what you call)

Merchants call:

`POST /api/v1/funding/withdrawals`

Body includes `amount` and `metadata` with the DPay fields listed above (as mapped).

