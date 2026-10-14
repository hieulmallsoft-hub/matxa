# Nạp ví bằng QR PayOS – Mobile API

Tất cả endpoint dùng `Authorization: Bearer <accessToken>`.

## Tạo giao dịch và QR

```http
POST /api/wallet/topups
```

```json
{ "amount": 50000, "paymentMethod": "PAYOS" }
```

Response thành công trả về:

```json
{
  "transactionId": "uuid",
  "amount": 50000,
  "currency": "VND",
  "status": "PENDING_PAYMENT",
  "paymentMethod": "PAYOS",
  "checkoutUrl": "https://pay.payos.vn/...",
  "qrCode": "000201010212...",
  "expiresAt": "2026-10-15T09:00:00.000Z"
}
```

`qrCode` là chuỗi QR payload của PayOS; mobile dùng thư viện QR để render, hoặc mở `checkoutUrl`. Mobile không tự cộng số dư và không tự chuyển trạng thái.

## Xác nhận thanh toán

PayOS gọi webhook backend:

```http
POST /api/payments/payos/wallet/webhook
```

Backend xác minh chữ ký, mã giao dịch và số tiền. Nếu hợp lệ, backend chuyển top-up sang `SUCCESS`, cộng ví đúng một lần và ghi ledger.

Mobile kiểm tra trạng thái:

```http
GET /api/wallet/topups/:transactionId
GET /api/wallet
```

Chỉ hiển thị thành công khi `status` là `SUCCESS`.

## Trạng thái

| Status | Mobile |
|---|---|
| `PENDING_PAYMENT` | Hiển thị QR, chờ thanh toán |
| `PROCESSING` | Đang xác nhận |
| `SUCCESS` | Báo thành công, tải lại số dư |
| `FAILED` | Báo thất bại, cho phép tạo giao dịch mới |
| `EXPIRED` | QR hết hạn, tạo giao dịch mới |
| `CANCELLED` | Đã hủy |

Mobile có thể gọi API chi tiết mỗi 3–5 giây trong lúc chờ hoặc gọi lại khi app được mở lại.

## Kiểm thử

1. Đăng nhập user và lấy access token.
2. Gọi `POST /api/wallet/topups` với `paymentMethod: PAYOS`.
3. Hiển thị QR/checkout URL trả về.
4. Thanh toán trên môi trường PayOS test.
5. Chờ webhook.
6. Gọi `GET /api/wallet/topups/:transactionId`.
7. Khi `SUCCESS`, gọi `GET /api/wallet` và kiểm tra số dư tăng đúng một lần.

Nếu PayOS chưa gọi được webhook, kiểm tra URL webhook PayOS trỏ tới:

```text
http://149.28.156.66/api/payments/payos/wallet/webhook
```

Thời hạn giao dịch lấy từ `PAYOS_PAYMENT_TTL_MINUTES` (hiện là 15 phút). Webhook là nguồn xác nhận chính; redirect về app chỉ để đóng màn hình thanh toán, sau đó mobile vẫn phải đọc lại trạng thái giao dịch.
