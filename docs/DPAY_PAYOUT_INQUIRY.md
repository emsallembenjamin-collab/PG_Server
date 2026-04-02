# DPay payout inquiry (`Look/pay_order`)

GoldPay exposes this as **`POST /api/v1/funding/payout-inquiry`** (merchant API key). The backend calls DPay with **platform** `merchant_num` and signing secret.

## Upstream (DPay)

| | |
|--|--|
| **URL** | `https://pay.dpayvn.com/Look/pay_order` (override with `DPAY_PAYOUT_INQUIRY_LOOK_BASE_URL`) |
| **Method** | `POST` |
| **Content-Type** | `application/x-www-form-urlencoded;charset=UTF-8` |

### Form fields

| Field | Required | Description |
|-------|----------|-------------|
| `merchant_num` | yes | Merchant ID (GoldPay uses env `DPAY_MERCHANT_NUM`) |
| `merchant_order` | yes | Same order id as the payout / withdrawal |
| `find_date` | yes | `YYYY-MM-DD HH:mm:ss` |
| `sign` | yes | Computed by GoldPay (same rules as other DPay APIs) |

### Response (`code`)

- **`1`** — success; read `data` object.
- **Other** — error; see `docs/DPAY_ERROR_CODES.md` and `message`.

### `data` fields (success)

| Field | Meaning |
|-------|--------|
| `serial_number` | DPay serial |
| `merchant_order` | Order number |
| `state` | `1` success, `2` pending payout |
| `success_time` | `YYYY-MM-DD HH:mm:ss` |
| `coin` | Amount in VND (1 unit = 1 VND) |

GoldPay maps `state` to `payout.state_label`:
- `1` -> `succeeded`
- `2` -> `processing`

## GoldPay request body

Either:

- **`transaction_id`**: GoldPay **withdrawal** id — we derive `merchant_order` (same rules as withdrawal metadata / `tx_{id}`) and `find_date` from `created_at` (+7h format like DPay), or  
- **`merchant_order`** + **`find_date`**: pass through to DPay.

## GoldPay response

- **`success: true`**: `code`, `message`, `payout` (normalized fields above).  
- **`success: false`**: `provider_error`, optional `raw` for debugging.
