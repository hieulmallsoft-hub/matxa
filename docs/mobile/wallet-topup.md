# Wallet Top-up – Mobile API (Phase 1)

Phase 1 is a wallet foundation with bank-transfer instructions and Admin/development simulation. It does not integrate Napas or a real bank provider. Mobile must never mark a payment successful or add balance itself.

All endpoints use `Authorization: Bearer <accessToken>`.

## Flow

```text
POST /wallet/topups
  -> show bank instruction and referenceCode
  -> user transfers money
GET /wallet/topups/:id (poll status)
  -> SUCCESS: refresh GET /wallet
  -> FAILED/EXPIRED: create a new top-up to retry
```

## Create top-up

```http
POST /api/wallet/topups
```

```json
{ "amount": 50000, "paymentMethod": "BANK_TRANSFER" }
```

Amount is an integer VND value. The server validates configured min/max limits and derives the user from the token.

Response:

```json
{
  "transactionId": "uuid",
  "amount": 50000,
  "currency": "VND",
  "status": "PENDING_PAYMENT",
  "paymentMethod": "BANK_TRANSFER",
  "bank": {
    "bankName": "Vietcombank",
    "accountName": "PSYCORE",
    "accountNumber": "0123456789"
  },
  "transferContent": "NAP PSY ABC123",
  "referenceCode": "ABC123",
  "expiresAt": "2026-10-02T09:00:00.000Z"
}
```

## Wallet and history

```http
GET /api/wallet
GET /api/wallet/topups?page=1&limit=20
GET /api/wallet/topups/:transactionId
```

`GET /wallet` returns `balanceVnd`, `currency`, and wallet `type` (`ADVERTISING_CREDIT`). A user can only access their own wallet and top-ups.

## Status mapping

| API status        | Mobile screen                          |
| ----------------- | -------------------------------------- |
| `PENDING_PAYMENT` | Bank transfer instruction              |
| `PROCESSING`      | Processing                             |
| `SUCCESS`         | Top-up success, refresh wallet balance |
| `FAILED`          | Failed, create a new top-up to retry   |
| `EXPIRED`         | Expired, create a new top-up           |
| `CANCELLED`       | Cancelled                              |

## Development simulation

Only Admin can call these endpoints and they are disabled when `NODE_ENV=production`:

```http
POST /api/admin/wallet/topups/:id/simulate-success
POST /api/admin/wallet/topups/:id/simulate-failure
```

These endpoints are for local/integration testing only. Mobile must not call them.

Success credits the wallet and writes exactly one immutable ledger entry. Repeating the success request is idempotent and cannot double-credit. Failure/expiry never credits the wallet.

## Errors

```json
{
  "statusCode": 400,
  "message": "So tien phai la so nguyen duong",
  "error": "Bad Request"
}
```

Typical statuses: `400` validation, `401` invalid token, `403` Admin-only endpoint, `404` transaction not owned/not found, `409` invalid transition.

## Phase 2 limitation

There is currently no Napas/bank provider, signed webhook, provider signature verification, or production reconciliation. The Admin simulation stands in for provider confirmation during Phase 1. These must be implemented before production bank payments are enabled.
