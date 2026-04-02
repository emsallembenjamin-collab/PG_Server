# DPay bank/channel list (CDC M) (`/index/bank_list`)

GoldPay exposes this upstream API as:

`POST /api/v1/funding/bank-list` (merchant API key)

It only works when the merchant's assigned provider is **dpay**.

## 1. GoldPay request

`Content-Type: application/json`

Body:

| Field | Required | Notes |
|--------|----------|-------|
| `pay_type` | yes | 9=banktransfer, 8=momo, 7=bankQR, 6=MomoToBank, 5=ZaloToBank, 4=VietteToBank |

## 2. Upstream (DPay)

GoldPay calls:

`POST https://pay.dpayvn.com/index/bank_list`

`Content-Type: application/x-www-form-urlencoded;charset=UTF-8`

Form fields sent by GoldPay:

- `merchant_num` (env `DPAY_MERCHANT_NUM`)
- `pay_type` (your request body)
- `sign` (computed via `DPAY_SECRET` + `DPAY_SIGN_*`)

## 3. Response mapping

On success (`code == 1`):

```json
{
  "success": true,
  "code": 1,
  "message": "ok",
  "data": [
    { "code": 3, "bank_name": "VIB" },
    { "code": 5, "bank_name": "VTB" }
  ]
}
```

On failure (for example `code=1022`, `data=[]`):

```json
{
  "success": false,
  "provider_error": { "code": 1022, "message": "user error" },
  "raw": { "...upstream body..." }
}
```

Use `docs/DPAY_ERROR_CODES.md` to interpret DPay error codes/messages (especially `1022`).

