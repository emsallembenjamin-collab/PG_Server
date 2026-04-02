# GoldPay Merchant API

This document describes the **public integration surface** for merchants. You integrate with **GoldPay only** (REST + webhooks). You do **not** integrate directly with upstream payment providers (for example DPay); the platform assigns one provider per merchant and calls it using platform credentials.

For an interactive reference (try requests, schemas), open:

- **Swagger UI (Merchant):** `{BASE_URL}/api/docs/merchant`  
- **OpenAPI JSON:** `{BASE_URL}/api/docs/merchant-json` (for codegen / Postman import)
- **Merchant Test Pages (HTML forms):** `{BASE_URL}/api/v1/merchant-ui` (deposit/withdraw + inquiries)
- **Merchant Docs Page (HTML):** `{BASE_URL}/api/v1/merchant-ui/docs`

Full platform docs (admin JWT, provider callbacks, etc.) are at `{BASE_URL}/api/docs`.

Replace `{BASE_URL}` with your environment origin, e.g. `https://pay.example.com` (no trailing slash). API routes are prefixed with `/api/v1` unless your operator configures otherwise (`API_PREFIX`).

---

## 1. Overview

| Item | Description |
|------|-------------|
| **Protocol** | HTTPS REST, JSON bodies |
| **Version** | v1 (`/api/v1/...`) |
| **Merchant auth** | `X-API-Key: <secret>` |
| **Provider** | Configured by platform admin per merchant (`provider_id`); not chosen per request |
| **Idempotency** | Optional `idempotency_key` on create requests |

---

## 2. Authentication

Every merchant request must include:

```http
X-API-Key: <your_api_secret>
```

The secret is created or rotated by the platform admin (or via `POST /merchants/me/api-keys/rotate`).

### 2.1 IP allowlist (optional)

If the merchant record has `whitelisted_ips` set, requests must come from one of those IPs or they receive `403 Forbidden`.

---

## 3. Core concepts

### 3.1 Assigned provider

Your merchant account has exactly one **assigned provider**. Deposit and withdrawal requests are executed against that provider using **platform** keys. Your API key only authorizes **your** merchant; it does not expose upstream provider secrets.

### 3.2 Transaction

A **transaction** is a deposit or withdrawal with lifecycle status: `pending` → `processing` → `succeeded` | `failed` | `reversed` (and intermediate states depending on flow).

### 3.3 Payment instructions (`payment`)

On create, the response may include a **`payment`** object with normalized instructions (redirect URL, QR payload, bank fields, etc.). The exact keys depend on the assigned provider; GoldPay maps them into a single object for your integration.

---

## 4. Endpoints (merchant)

All paths below are relative to `{BASE_URL}/api/v1`.

### 4.1 Profile

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/merchants/me` | Current merchant profile (includes `provider_id`, webhook settings, status). |
| `POST` | `/merchants/me/api-keys/rotate` | Body: `{ "name": "optional label" }`. Returns `{ "api_key": "<new secret>" }`. |

### 4.2 Funding (recommended)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/funding/deposits` | Create a **deposit**; response includes `payment` when available. |
| `POST` | `/funding/withdrawals` | Create a **withdrawal**. |
| `POST` | `/funding/payout-inquiry` | **DPay only:** query payout status (`Look/pay_order`). Body: `transaction_id` (withdrawal) and/or `merchant_order` + `find_date`. See `docs/DPAY_PAYOUT_INQUIRY.md`. |
| `POST` | `/funding/balance-inquiry` | **DPay only:** query merchant coin/fcoin (`Look/get_coin`). Body: optional `find_date`. See `docs/DPAY_BALANCE_INQUIRY.md`. |
| `POST` | `/funding/bank-list` | **DPay only:** query available banks/channels (`/index/bank_list`, CDC M). Body: `pay_type` (e.g. `7`=bankQR). |

If your assigned provider is **DPay**, withdrawal calls ultimately use DPay **`payment.dpayvn.com/payment`** (bank payout). Required DPay fields are provided via `metadata` and mapped by GoldPay:

- `metadata.target_bank`, `metadata.bank_name`, `metadata.target_bank_user`
- `metadata.extend`, `metadata.order_date`
- `metadata.order` (or `metadata.merchant_order` / `metadata.m_order`)
- optional: `metadata.notifyurl`, `metadata.user_ip`, `metadata.userinfo`, `metadata.uid`, `metadata.merchant_num`

Full mapping is documented in `docs/DPAY_PAYOUT_API.md`.

If your assigned provider is **DPay**, deposit integration details (DPay `pay_type`, optional `bank_code`, and how `deposit_mode` selects the DPay endpoint) are documented in `docs/DPAY_DEPOSIT_API.md`.

### 4.3 Transactions (alternate paths)

Same behavior as funding routes; includes explicit `type` in the body.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/transactions` | Body includes `type`: `deposit` or `withdrawal`. |
| `GET` | `/transactions` | List your transactions (pagination + filters). |
| `GET` | `/transactions/:id` | Get one transaction by id. |

---

## 5. Request bodies (create deposit / withdrawal)

Fields align with `CreateTransactionDto` / funding DTOs (see Swagger for full validation).

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `amount` | number | Yes | Minimum `0.01` |
| `currency` | string | No | Default `USD` |
| `reference_id` | string | No | Your reference in your system |
| `idempotency_key` | string | No | Same key + same merchant returns the **same** response |
| `metadata` | object | No | Extra fields passed to the provider adapter where supported |
| `sandbox` | object | No | Only when merchant is assigned the **sandbox** provider |

If you submit requests as `application/x-www-form-urlencoded` (HTML form), then:

- send `metadata` as a JSON string value (e.g. `metadata={"userinfo":"user-1","pay_callbackurl":"https://..."}`)  
- send `sandbox` as a JSON string value (e.g. `sandbox={"outcome":"processing_then_success","delay_ms":1500}`)  

### Example (deposit)

```http
POST /api/v1/funding/deposits
X-API-Key: <secret>
Content-Type: application/json

{
  "amount": 100000,
  "currency": "VND",
  "reference_id": "order-2026-001",
  "idempotency_key": "idem-order-2026-001",
  "metadata": {
    "userinfo": "user-123",
    "pay_callbackurl": "https://your-site.com/pay/return"
  }
}
```

---

## 6. Response shape (create / get)

Successful create returns a **merchant transaction** object:

```json
{
  "id": 42,
  "merchant_id": 3,
  "type": "deposit",
  "amount": 100000,
  "currency": "VND",
  "reference_id": "order-2026-001",
  "external_id": "upstream-order-ref",
  "status": "processing",
  "failure_reason": null,
  "metadata": { },
  "provider": {
    "id": 2,
    "name": "dpay",
    "display_name": "DPay"
  },
  "payment": {
    "url": "https://...",
    "payurl": "https://...",
    "serial_number": "..."
  },
  "created_at": "2026-04-01T12:00:00.000Z",
  "updated_at": "2026-04-01T12:00:00.000Z"
}
```

- **`payment`**: Present when the provider returned usable instructions. Keys vary by provider (QR, bank account, etc.).  
- **`metadata`**: Sandbox flags and other non-payment fields; `payment_details` are merged into `payment` and not duplicated in `metadata` in the response.

---

## 7. Errors (HTTP)

| Code | Meaning |
|------|--------|
| `400` | Validation, bad business rule (e.g. no provider assigned, amount out of range) |
| `401` | Missing or invalid `X-API-Key` |
| `403` | IP not whitelisted |
| `404` | Unknown transaction id (or idempotency cache miss) |

Error body is typically Nest’s JSON `{ "statusCode", "message", "error" }`.

### 7.1 Provider errors (e.g. DPay)

Create/funding responses use **HTTP 200** with `status: "failed"` when the **assigned upstream provider** rejects the operation. In that case you receive:

- **`failure_reason`** — short error text (also stored on the transaction).
- **`provider_error`** — when the provider returns a structured code (DPay’s `code` + English message):

```json
{
  "status": "failed",
  "failure_reason": "sign check error!",
  "provider_error": {
    "code": "1018",
    "message": "sign check error!"
  }
}
```

DPay documents many numeric/string codes and `1022` validation messages. See **`docs/DPAY_ERROR_CODES.md`** in this repository for the full reference table.

---

## 8. Webhooks (outbound to your server)

When a transaction reaches a **final** or **notable** state, GoldPay may `POST` to your **`webhook_url`** (if configured on the merchant).

### 8.1 Payload

```json
{
  "event": "transaction.updated",
  "transaction": {
    "id": 42,
    "type": "deposit",
    "amount": 100000,
    "currency": "VND",
    "status": "succeeded",
    "reference_id": "order-2026-001",
    "external_id": "upstream-order-ref",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### 8.2 Signature

If `webhook_secret` is set on the merchant, GoldPay sends:

```http
X-Webhook-Signature: <hex>
```

The value is **HMAC-SHA256** over the **raw JSON body** (stringified as sent), using the webhook secret as key, output **hex-encoded**.

Verify on your side using the same algorithm before trusting the payload.

---

## 9. Idempotency

Include `idempotency_key` on create. The **first** successful response is stored; repeated requests with the same key return the **same** response body for that merchant.

---

## 10. Support checklist for merchants

1. Obtain API key from platform admin.  
2. Confirm base URL and `API_PREFIX` (usually `/api/v1`).  
3. Implement deposit/withdraw using `/funding/deposits` and `/funding/withdrawals`.  
4. Implement webhook endpoint + signature verification.  
5. Use `/api/docs/merchant` or `MERCHANT_API.md` + OpenAPI JSON for your team.  
6. If the assigned provider is DPay, keep **`docs/DPAY_ERROR_CODES.md`** for support and error-code lookup.  
7. DPay **payout JSON callback** to the platform is documented in **`docs/DPAY_PAYOUT_CALLBACK.md`** (operator / infra).
8. DPay **deposit JSON callback** to the platform is documented in **`docs/DPAY_DEPOSIT_CALLBACK.md`**.

---

## 11. Changelog

| Version | Notes |
|---------|--------|
| 1.0 | Initial merchant doc (Funding API, sync provider response, `payment` field, merchant Swagger) |
