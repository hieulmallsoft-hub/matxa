# PayOS thanh toán booking

Booking online vẫn tạo bằng:

```http
POST /api/bookings
```

với `paymentMethod=ONLINE`. Sau đó Mobile gọi:

```http
POST /api/bookings/{bookingId}/payos-payment
Authorization: Bearer <access-token>
```

Response trả `paymentUrl`; mở URL này bằng browser/webview. Chỉ webhook PayOS mới chuyển payment sang `PAID`.

Webhook phải cấu hình trên PayOS:

```text
https://<api-domain>/api/payments/payos/webhook
```

Các biến môi trường chỉ đặt trên backend/server:

```env
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_RETURN_URL=<universal-link-or-web-return-url>
PAYOS_CANCEL_URL=<universal-link-or-web-cancel-url>
PAYOS_APP_RETURN_URL=psyocore://payment/payos/success
PAYOS_APP_CANCEL_URL=psyocore://payment/payos/cancel
PAYOS_PAYMENT_TTL_MINUTES=15
```

`PAYOS_RETURN_URL` và `PAYOS_CANCEL_URL` là URL backend public:

```text
https://<api-domain>/api/payments/payos/return
https://<api-domain>/api/payments/payos/cancel
```

Hai endpoint này redirect tiếp đến `PAYOS_APP_RETURN_URL` hoặc `PAYOS_APP_CANCEL_URL`. Có thể thay deep link bằng HTTPS Universal Link/App Link nếu mobile đã cấu hình domain.

Callback lặp được xử lý idempotent. Không đánh dấu thanh toán thành công từ `returnUrl`; trạng thái chỉ do webhook chữ ký hợp lệ cập nhật.
