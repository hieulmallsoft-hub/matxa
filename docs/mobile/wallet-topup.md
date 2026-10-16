# Mobile test nạp ví bằng PayOS

Tài liệu này dùng để mobile kiểm thử luồng nạp tiền thật qua QR PayOS.

## Thông tin môi trường

```text
Base URL: http://149.28.156.66
```

Tài khoản gọi API phải là KTV đã được duyệt và đang hoạt động. Mọi request cần có:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Mobile không được tự đổi trạng thái giao dịch hoặc tự cộng số dư.

## Luồng chính

```text
POST /api/wallet/topups
  -> nhận checkoutUrl/qrCode
  -> hiển thị QR hoặc mở checkoutUrl
  -> người dùng thanh toán trên ngân hàng
  -> PayOS gọi webhook backend
  -> mobile poll GET /api/wallet/topups/{transactionId}
  -> SUCCESS: gọi GET /api/wallet
```

## 1. Tạo giao dịch nạp

```http
POST /api/wallet/topups
```

```json
{
  "amount": 1000,
  "paymentMethod": "PAYOS"
}
```

`amount` là số nguyên VND. Mức tối thiểu mặc định hiện tại là 1.000 VND để phục vụ kiểm thử. Server có thể ghi đè bằng biến môi trường `WALLET_TOPUP_MIN_VND`.

```json
{
  "transactionId": "12b17c82-52c8-472e-9301-3660fb6fcf28",
  "amount": 1000,
  "currency": "VND",
  "status": "PENDING_PAYMENT",
  "paymentMethod": "PAYOS",
  "referenceCode": "PSYMV...",
  "transferContent": "NAP PSY PSYMV...",
  "checkoutUrl": "https://pay.payos.vn/web/...",
  "qrCode": "000201...",
  "accountNumber": "...",
  "accountName": "...",
  "expiresAt": "2026-10-16T03:01:13.829Z"
}
```

Mỗi lần thử lại phải tạo giao dịch mới. Không dùng lại QR hoặc `checkoutUrl` đã hết hạn.

## 2. Hiển thị và thanh toán

- `checkoutUrl` là link thanh toán PayOS. Mobile có thể mở bằng trình duyệt hoặc in-app browser.
- `qrCode` là chuỗi dữ liệu QR EMVCo, không phải URL và không phải ảnh Base64. Mobile truyền nguyên chuỗi này vào thư viện QR để render.
- Không thay đổi, encode lại hoặc tự tạo nội dung chuyển khoản.
- Hiển thị số tiền, thời gian hết hạn và trạng thái `PENDING_PAYMENT`.

Khi kiểm thử thủ công trên Swagger, copy riêng giá trị `checkoutUrl` bắt đầu bằng `https://pay.payos.vn/web/`, mở link đó rồi dùng app ngân hàng quét QR.

## 3. Theo dõi trạng thái

```http
GET /api/wallet/topups/{transactionId}
```

Mobile gọi mỗi 3–5 giây trong lúc màn hình thanh toán mở và gọi lại khi app quay lại foreground. Dừng polling khi nhận trạng thái cuối:

| API status | Xử lý trên mobile |
|---|---|
| `PENDING_PAYMENT` | Hiển thị QR, chờ người dùng thanh toán |
| `PROCESSING` | Hiển thị đang xác nhận, tiếp tục polling |
| `SUCCESS` | Báo nạp thành công, gọi `GET /api/wallet` |
| `FAILED` | Báo thất bại, cho phép tạo giao dịch mới |
| `EXPIRED` | Báo QR hết hạn, tạo giao dịch mới |
| `CANCELLED` | Báo giao dịch đã hủy |

Chỉ hiển thị thành công khi API trả `status: "SUCCESS"`. Redirect/deep link của PayOS chỉ đưa người dùng về app, không dùng để tự xác nhận.

Backend tự đánh dấu giao dịch `EXPIRED` sau thời điểm `expiresAt` (mặc định 15 phút). Việc này chạy độc lập với mobile, nên người dùng đóng app vẫn không làm mất giao dịch. Khi mở app lại, mobile dùng `transactionId` đã lưu để gọi `GET /api/wallet/topups/{transactionId}` hoặc tải `GET /api/wallet/transactions`; nếu nhận `SUCCESS` thì mở màn thành công, nếu nhận `EXPIRED` thì báo hết hạn và tạo giao dịch mới.

## 4. Kiểm tra số dư

Sau khi giao dịch `SUCCESS`:

```http
GET /api/wallet
```

Response có dạng:

```json
{
  "id": "wallet-id",
  "type": "ADVERTISING_CREDIT",
  "balanceVnd": 50000,
  "currency": "VND"
}
```

Số dư phải tăng đúng bằng số tiền đã thanh toán. Gọi lại API chi tiết hoặc refresh app không được cộng lần hai.

## 5. Lịch sử giao dịch ví

Lấy lịch sử tổng hợp từ ledger của ví:

```http
GET /api/wallet/transactions?page=1&limit=20
GET /api/wallet/transactions/{transactionId}
```

Mỗi item có `amountVnd` có dấu: số dương là tiền vào, số âm là tiền ra. `balanceBeforeVnd` và `balanceAfterVnd` là số dư trước/sau giao dịch. Với giao dịch nạp tiền, response có thêm `status`, `paymentMethod`, `referenceCode` và `failureMessage`.

Hiện ledger phát sinh giao dịch `TOP_UP` khi nạp ví thành công. Các loại chi tiền dịch vụ chỉ hiển thị sau khi backend có luồng sử dụng ví tương ứng.

## 6. Các bước test trên Swagger

1. Đăng nhập bằng tài khoản KTV đã được duyệt, copy `accessToken`.
2. Bấm **Authorize** và nhập `Bearer <accessToken>`.
3. Mở `POST /api/wallet/topups`, nhập amount `1000` hoặc `2000` và paymentMethod `PAYOS`.
4. Bấm **Execute**, lưu `transactionId` và `checkoutUrl`.
5. Mở `checkoutUrl`, quét QR và hoàn tất chuyển khoản thật.
6. Gọi `GET /api/wallet/topups/{transactionId}` sau mỗi 3–5 giây.
7. Khi status là `SUCCESS`, gọi `GET /api/wallet` và kiểm tra số dư.
8. Ghi lại transactionId, status cuối và số dư để bàn giao kết quả test.

## 7. Webhook backend

Mobile không gọi webhook. PayOS gọi endpoint này:

```http
POST /api/payments/payos/wallet/webhook
```

Webhook kiểm tra chữ ký PayOS, mã giao dịch và số tiền, sau đó cộng ví đúng một lần. Webhook PayOS đã được cấu hình trên kênh thanh toán của Psyocore.

Các URL redirect chỉ dùng để quay về app:

```text
http://149.28.156.66/api/payments/payos/return
http://149.28.156.66/api/payments/payos/cancel
```

## 8. Lỗi thường gặp

| Mã lỗi | Nguyên nhân/xử lý |
|---|---|
| `401` | Token thiếu, sai hoặc hết hạn; đăng nhập và Authorize lại |
| `403` | Tài khoản chưa phải KTV đã được duyệt và kích hoạt |
| `400 PayOS chua duoc cau hinh` | Backend thiếu biến môi trường PayOS |
| `PENDING_PAYMENT` quá lâu | Kiểm tra webhook PayOS và log backend; không tự cộng số dư |
| `EXPIRED` | Tạo giao dịch mới, không dùng QR cũ |

Các endpoint Admin `simulate-success` và `simulate-failure` chỉ dành cho kiểm thử nội bộ, mobile không gọi.
