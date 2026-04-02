# DPay deposit callback (JSON notify)

GoldPay receives DPay deposit completion callbacks at:

`POST {BACKEND_URL}/api/v1/webhooks/providers/dpay/callback`

Configure this URL in the DPay merchant dashboard as your **deposit notify URL**.

## Request

- Method: `POST`
- Content-Type: `application/json`

### JSON fields

| Field | Required | Meaning |
|--------|----------|---------|
| `code` | yes | `1` success; non-successful states are typically not notified |
| `merchant_num` | yes | Merchant ID |
| `coin` | yes | Deposit amount in VND (`1 unit = 1 VND`) |
| `pay_coin` | yes | Amount actually paid by the user (`1 unit = 1 VND`) |
| `merchant_order` | yes | Merchant order number |
| `serial_number` | yes | DPay serial number |
| `order_time` | yes | `YYYY-MM-DD HH:mm:ss` |
| `success_time` | yes | `YYYY-MM-DD HH:mm:ss` |
| `sign` | yes | Signature |

## Signature verification

GoldPay verifies `sign` in the JSON body using the DPay secret (`DPAY_WEBHOOK_SECRET` or `DPAY_SECRET`, see operator env).

On invalid signature, GoldPay returns `401`.

## Response (required by DPay)

Return plain text:

```text
SUCCESS
```

so DPay stops retries.

