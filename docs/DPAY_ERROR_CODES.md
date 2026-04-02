# DPay provider error codes (reference)

GoldPay calls DPay using **platform** credentials. When DPay returns a business error, the GoldPay API surfaces:

- **`provider_error.code`** — DPay `code` field (string or number as returned).
- **`provider_error.message`** — DPay English message (often same as `message` / `msg` in their JSON).

Cross-reference this table when debugging merchant `metadata` or support tickets. Success responses from DPay use **`code === "1"`** (string `1`).

---

## Named error codes

| Code | English | 中文 |
|------|---------|------|
| 1001 | pay system maintaining | 系统维护 |
| 1017 | Merchant information is incorrect! | 商家信息有误！ |
| 1018 | sign check error! | 签名验证失败！ |
| 1019 | ip not on the whitelist! | IP 不在白名单中！ |
| 1077 | unsupported bank code | 不支持的银行代码 |
| 1078 | the amount range is | 金额范围是 |
| 1079 | Order number already exists | 订单号已存在 |
| 1080 | merchant insufficient amount! | 商户余额不足！ |
| 1083 | The bank is under maintenance | 该银行正在进行维护 |
| 1102 | query too frequently | 查询过于频繁 |
| 1105 | Order does not exist | 订单不存在 |

---

## Code `1022` — validation and other messages

DPay often returns **`1022`** with different **English message** strings; the exact problem is in the message text.

| English message |
|-----------------|
| uid field cannot be empty |
| pay_type field cannot be empty! |
| merchant_num field cannot be empty! |
| coin field cannot be empty! |
| merchant_order field cannot be empty! |
| merchant_order incorrect format! |
| pay_notifyurl incorrect format! |
| pay_callbackurl incorrect format! |
| user_ip incorrect format! |
| extend incorrect format! |
| extend length cannot be greater than 190! |
| userinfo field cannot be empty! |
| userinfo incorrect format! |
| you have too many unpaid orders! |
| create order error |
| No channels that meet the criteria |
| pay url is Null! |
| request method error! |
| Missing field |
| info error |
| Other errors |
| error request |
| bank_name cannot be empty |
| asynchronous notification addresses do not allow special characters |
| merchant_num cannot be empty |
| merchant_num error |
| order cannot be empty |
| order error |
| target_bank cannot be empty |
| target_bank error |
| target_bank_user cannot be empty |
| target_bank_user error |
| callback address or notification address error, length cannot exceed 145 |

---

## GoldPay mapping

1. Failed DPay HTTP responses are normalized into `ProcessTransactionResponse` with `providerErrorCode` and `providerErrorMessage`.
2. `TransactionsService` persists them under `metadata.provider_error` and returns **`provider_error`** on the merchant transaction object (see `MERCHANT_API.md`).
3. **`failure_reason`** on the transaction still holds the human-readable error string for logs and webhooks.

Merchants should use **`provider_error.code`** + **`provider_error.message`** together with this document; for `1022`, rely on the **message** text to know which field or rule failed.
