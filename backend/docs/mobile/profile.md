# Profile API - Mobile Integration

## 1. Màn hình sử dụng

- Tài khoản.
- Thông tin cá nhân.
- Chỉnh sửa tên hiển thị, giới tính, quốc tịch và avatar.
- Xác minh/liên kết số điện thoại trước khi đặt dịch vụ.

## 2. Authentication

Các endpoint profile yêu cầu `Authorization: Bearer <accessToken>`. User luôn được lấy từ token; Mobile không gửi `userId`.

## 3. Current profile

`GET /api/profile/me` hoặc `GET /api/auth/me`.

`/api/profile/me` trả dữ liệu hồ sơ; `/api/auth/me` trả auth user tương ứng với login session. Response profile thực tế:

```json
{
  "id": "user-id",
  "displayName": "Thu Huong",
  "avatarUrl": "https://.../avatars/user-id/saved/avatar.jpg",
  "gender": "FEMALE",
  "nationality": "Viet Nam",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "email": "user@example.com",
  "phone": "+84901234567",
  "phoneVerified": true,
  "onboardingCompleted": true
}
```

`phoneVerified=true` chỉ khi tài khoản có identity PHONE đã liên kết; Create Booking vẫn kiểm tra lại ở backend.

## 4. Update profile

`PATCH /api/profile/me`

Request hợp lệ:

```json
{
  "displayName": "Nguyễn Văn A",
  "gender": "MALE",
  "nationality": "Việt Nam",
  "avatarKey": "avatars/user-id/uuid.jpg"
}
```

Backend trả profile mới nhất ngay sau update. `displayName` được trim, không được rỗng và tối đa 100 ký tự; Unicode tiếng Việt được giữ nguyên.

Các field Mobile được phép sửa: `displayName`, `gender`, `nationality`, `avatarKey`.

Readonly/không được gửi: `id`, `email`, `phone`, `phoneVerified`, `role`, `status`, `onboardingCompleted`, password, password hash, session/refresh token, createdAt.

## 5. Avatar

### Bước 1: lấy presigned URL

`POST /api/profile/avatar-upload-url`

```json
{
  "fileName": "avatar.jpg",
  "contentType": "image/jpeg",
  "size": 250000
}
```

Hỗ trợ `image/jpeg`, `image/png`, `image/webp`, tối đa 5 MiB. Response:

```json
{
  "uploadUrl": "https://...signed-url",
  "mediaUrl": "https://.../avatars/user-id/uuid.jpg",
  "mediaKey": "avatars/user-id/uuid.jpg",
  "expiresIn": 300
}
```

### Bước 2: upload và lưu profile

Mobile PUT file trực tiếp tới `uploadUrl`, sau đó gọi `PATCH /api/profile/me` với `avatarKey=mediaKey`. Backend kiểm tra key thuộc đúng user, copy sang key lưu chính, cập nhật `avatarUrl`, rồi dọn ảnh cũ.

Không gửi base64 ảnh trong JSON và không tự đặt URL/avatarKey của user khác.

## 6. Email

Profile hiện không có flow đổi email. Email lấy từ UserIdentity và chỉ đọc trong profile. Đổi email vẫn dùng auth flow tương ứng nếu sản phẩm bổ sung sau này; Mobile không gửi email vào PATCH profile.

## 7. Phone number và OTP

Đổi/liên kết số điện thoại dùng flow auth hiện có:

```text
POST /api/auth/phone/link/send-otp
→ nhận challengeId/debugOtp chỉ ở development
→ POST /api/auth/phone/link/verify-otp
→ phone identity được liên kết
→ GET /api/profile/me trả phoneVerified=true
```

Gửi OTP:

```json
{ "phoneNumber": "+84901234567", "deviceId": "device-id" }
```

Xác minh:

```json
{ "challengeId": "challenge-id", "code": "123456", "deviceId": "device-id" }
```

Phone mới không được cập nhật bằng `PATCH /api/profile/me` và Mobile không được tự set `phoneVerified=true`. Trong production OTP phải đi qua SMS provider; `debugOtp` chỉ có ở development.

## 8. Booking requirement

Nếu `phoneVerified=false`, Mobile phải đưa người dùng tới flow link phone trước khi đặt dịch vụ. Backend `POST /api/bookings` vẫn kiểm tra và trả lỗi `PHONE_VERIFICATION_REQUIRED` nếu chưa xác minh.

## 9. Role và status

Role thực tế: `CUSTOMER`, `TECHNICIAN`, `ADMIN`. Status thực tế: `ACTIVE`, `BLOCKED`, `DELETED`. Mobile có thể dùng các field này để render menu/trạng thái, nhưng authorization luôn do backend guard quyết định.

Technician profile chuyên môn vẫn thuộc Marketplace/Technician module; profile endpoint chỉ trả role và thông tin User, không trộn bio/services/schedules vào đây.

## 10. Logout + FCM

Khi logout một thiết bị:

```text
DELETE /api/notifications/devices với FCM token hiện tại
→ POST /api/auth/logout
→ clear access/refresh token local
```

Không xóa token của các thiết bị khác. Nếu logout-all thì dùng `/api/auth/logout-all` và xử lý toàn bộ session theo auth flow.

## 11. UI state

- Loading: skeleton profile.
- Success: hiển thị dữ liệu mới nhất từ response.
- Updating: disable nút lưu, hiển thị progress upload nếu đổi avatar.
- Error: giữ dữ liệu form để sửa/thử lại; tải lại profile sau lỗi conflict.

## 12. Error handling

- `401`: access token thiếu/hết hạn → refresh hoặc đăng nhập lại.
- `400`: displayName rỗng, gender không hợp lệ, avatarKey/upload metadata không hợp lệ → sửa input.
- `404`: user không tồn tại hoặc upload object không tồn tại → tải lại/upload lại.
- `409`: profile/avatar vừa bị cập nhật bởi thiết bị khác → GET profile rồi thử lại.
- `403 PHONE_VERIFICATION_REQUIRED`: bắt buộc hoàn tất OTP trước khi booking.
- `429`: OTP hoặc auth vượt giới hạn → chờ theo thời gian server trả về.

## 13. Mobile không được làm

- Không gửi `userId` để lấy/sửa profile.
- Không gửi hoặc sửa `role`, `status`, `phoneVerified`.
- Không gửi email/phone vào PATCH profile để bypass verification.
- Không lưu password, password hash, refresh token trong profile state.
- Không tự tính `onboardingCompleted` làm source of truth.
- Không coi profile cache local là dữ liệu cuối cùng sau update.
