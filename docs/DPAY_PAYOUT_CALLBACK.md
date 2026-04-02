# DPay payout callback (JSON notify)

GoldPay receives DPay **payout completion** notifications at:

`POST {BACKEND_URL}/api/v1/webhooks/providers/dpay/callback`

Configure the same URL in the DPay merchant dashboard as the **payout / withdrawal notify** URL (the `notifyurl` sent when creating a payout matches this path via `BACKEND_URL`).

## Request

| | |
|--|--|
| **Method** | `POST` |
| **Content-Type** | `application/json` |

### Body fields (per DPay)

| Field | Notes |
|-------|--------|
| `code` | `1` = success. When `0`, DPay docs state this field **does not participate in signature**. |
| `merchant_num` | Merchant ID |
| `coin` | Payout amount in **VND** (1 unit = 1 VND) |
| `merchant_order` | Your order number (same as withdrawal order) |
| `serial_number` | DPay serial |
| `order_time` | `YYYY-MM-DD HH:mm:ss` |
| `success_time` | `YYYY-MM-DD HH:mm:ss` |
| `message` | e.g. `SUCCESS` when `code === 1` |
| `sign` | Signature |

## Signature (GoldPay)

- Uses the same **MD5/key_value** rules as other DPay APIs (`DPAY_SIGN_*` env).
- Build signing payload from all fields **except** `sign`.
- If **`code` is `0`**, **`code` is omitted** from the string used to compute `sign`.
- Verify with **`DPAY_SECRET`** or **`DPAY_WEBHOOK_SECRET`** (either may be set).

## Response (required by DPay)

The HTTP body must be the plain text:

```text
SUCCESS
```

GoldPay returns `Content-Type: text/plain` and body `SUCCESS` so DPay stops retries.

## After verification

GoldPay matches `serial_number` / `merchant_order` to an internal withdrawal, updates status (`code` / `message`), and may notify your merchant’s **`webhook_url`** (GoldPay outbound webhook).
