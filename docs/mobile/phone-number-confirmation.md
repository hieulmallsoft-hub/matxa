# Đổi số điện thoại bằng xác nhận trên Mobile

Flow này không gửi SMS OTP.

1. Người dùng nhập số điện thoại mới.
2. Mobile chuẩn hóa để hiển thị lại số, ví dụ `+84 901 234 567`.
3. Hiển thị **một popup**: `Xác nhận dùng số +84 901 234 567?`
4. Nút **Chỉnh sửa** đóng popup và không gọi API. Nút **Xác nhận** gọi API bên dưới.

```http
PATCH /api/profile/me
Authorization: Bearer <access-token>
Content-Type: application/json

{ "phoneNumber": "+84901234567" }
```

Backend chỉ nhận số Việt Nam hợp lệ, chuẩn hóa về E.164, và từ chối nếu số đã thuộc tài khoản khác (`409`). Thành công trả lại profile với trường `phone` mới. Mobile chỉ cập nhật giao diện sau khi request thành công.

Các endpoint OTP cũ vẫn dành cho các luồng đăng nhập/liên kết cũ; màn đổi số điện thoại này không gọi `send-otp` hoặc `verify-otp`.
