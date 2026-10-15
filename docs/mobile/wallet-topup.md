# Hướng dẫn mobile test nạp ví bằng QR PayOS

Base URL production:

~~~text
http://149.28.156.66
~~~

Header bắt buộc:

~~~http
Authorization: Bearer <accessToken>
Content-Type: application/json
~~~

## 1. Tạo giao dịch

~~~http
POST /api/wallet/topups
~~~

~~~json
{
  "amount": 50000,
  "paymentMethod": "PAYOS"
}
~~~

Response:

~~~json
{
  "transactionId": "7d3c...uuid...",
  "amount": 50000,
  "currency": "VND",
  "status": "PENDING_PAYMENT",
  "paymentMethod": "PAYOS",
  "referenceCode": "ABC123",
  "checkoutUrl": "https://pay.payos.vn/web/...",
  "qrCode": "000201010212...",
  "expiresAt": "2026-10-15T10:30:00.000Z"
}
~~~

## 2. Hiển thị QR

qrCode là chuỗi dữ liệu QR EMVCo, thường bắt đầu bằng 000201. Đây không phải URL ảnh và không phải Base64 ảnh. Mobile truyền nguyên chuỗi qrCode vào thư viện QR:

- Android: ZXing hoặc QR encoder đang dùng.
- iOS: CoreImage với filter CIQRCodeGenerator.
- React Native/Flutter: component QR với value/data = qrCode.

Không sửa chuỗi, không URL-encode, không tự tạo nội dung chuyển khoản và không tự cộng số dư. checkoutUrl là phương án dự phòng để mở bằng trình duyệt hoặc in-app browser.

Màn hình cần hiện số tiền, QR, trạng thái Chờ thanh toán và expiresAt.

## 3. Xác nhận thành công

PayOS gọi webhook backend, mobile không gọi webhook:

~~~http
POST /api/payments/payos/wallet/webhook
~~~

Backend kiểm tra chữ ký, orderCode và số tiền, rồi chuyển giao dịch sang SUCCESS, cộng ví đúng một lần và ghi ledger.

Mobile poll trạng thái:

~~~http
GET /api/wallet/topups/{transactionId}
~~~

Gọi mỗi 3–5 giây khi màn hình thanh toán mở và gọi lại khi app quay lại foreground. Chỉ hiển thị thành công khi status là SUCCESS. Sau đó gọi GET /api/wallet để tải số dư mới.

Redirect/deep link chỉ đưa người dùng về app, không dùng redirect để tự xác nhận thanh toán.

## 4. Mapping trạng thái

| Status | Mobile |
|---|---|
| PENDING_PAYMENT | Hiện QR, chờ thanh toán |
| PROCESSING | Đang xác nhận |
| SUCCESS | Báo thành công, tải lại số dư |
| FAILED | Báo thất bại, tạo giao dịch mới |
| EXPIRED | QR hết hạn, tạo giao dịch mới |
| CANCELLED | Đã hủy |

PAYOS_PAYMENT_TTL_MINUTES hiện là 15 phút.

## 5. Các bước test trên Swagger

1. Đăng nhập user và copy accessToken.
2. Bấm Authorize, nhập Bearer <accessToken>.
3. Gọi POST /api/wallet/topups với amount 50000 và paymentMethod PAYOS.
4. Copy transactionId, checkoutUrl và qrCode.
5. Quét QR bằng điện thoại hoặc mở checkoutUrl.
6. Hoàn tất thanh toán trên tài khoản/ngân hàng test PayOS.
7. Gọi GET /api/wallet/topups/{transactionId} đến khi status là SUCCESS.
8. Gọi GET /api/wallet và kiểm tra số dư tăng đúng 50.000 VND.
9. Gọi lại API chi tiết; số dư không được cộng lần hai.

## 6. URL PayOS

Webhook Dashboard:

~~~text
http://149.28.156.66/api/payments/payos/wallet/webhook
~~~

Redirect:

~~~text
http://149.28.156.66/api/payments/payos/return
http://149.28.156.66/api/payments/payos/cancel
~~~

Deep link:

~~~text
psycore://payment/payos/success
psycore://payment/payos/cancel
~~~

Mobile không gọi endpoint Admin simulate-success/simulate-failure, không tự đổi trạng thái và không tự cộng số dư.

## 7. Lỗi thường gặp

- 401: token hết hạn hoặc thiếu Authorization.
- 400 PayOS chua duoc cau hinh: server thiếu biến PayOS.
- Có QR nhưng trạng thái không đổi: kiểm tra webhook PayOS Dashboard và log backend.
- EXPIRED: tạo giao dịch mới, không dùng QR cũ.

