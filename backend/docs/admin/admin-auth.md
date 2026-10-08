# Admin Authentication API - Web Integration

## 1. Mục đích

Web Admin dùng chung hệ thống Auth với mobile: đăng nhập bằng email/mật khẩu, lấy access token, xác minh phiên bằng `GET /api/auth/me`, sau đó gọi API quản trị. Hiện API quản trị Marketplace nằm dưới `/api/admin/marketplace/**`.

Admin là một `User` có `role = "ADMIN"` và `status = "ACTIVE"`; không có bảng Admin riêng. Role chỉ được gán bởi luồng quản trị/seed, không có API để frontend tự đổi role.

## 1.1 Tạo tài khoản Admin nội bộ

Không có API hay Swagger endpoint tạo Admin. Người vận hành tạo/cập nhật Admin bằng seed CLI trên server hoặc local trusted environment:

```bash
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="mat-khau-it-nhat-8-ky-tu" npm run db:seed-admin
```

PowerShell trên Windows:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "mat-khau-it-nhat-8-ky-tu"
npm.cmd run db:seed-admin
```

Lần đầu script tạo User `ADMIN` + email identity đã xác minh. Nếu email đã tồn tại, script chỉ đặt `role=ADMIN`, `status=ACTIVE` và giữ mật khẩu hiện có. Muốn cố ý reset mật khẩu, thêm `ADMIN_RESET_PASSWORD=true`.

## 2. Role được phép

| Role         | Gọi `/api/admin/marketplace/**` |
| ------------ | ------------------------------- |
| `ADMIN`      | Được phép                       |
| `CUSTOMER`   | `403 Forbidden`                 |
| `TECHNICIAN` | `403 Forbidden`                 |

Backend là nguồn xác thực cuối cùng. Việc frontend ẩn menu không thay thế authorization của backend.

## 3. Đăng nhập

```http
POST /api/auth/email/login
Content-Type: application/json
```

```json
{
  "email": "admin@example.com",
  "password": "MatKhauAnToan2026",
  "deviceId": "operations-web-a1b2c3"
}
```

Response thành công dùng chung với mobile:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "session-id.secret",
  "tokenType": "Bearer",
  "expiresIn": "15m",
  "user": {
    "id": "46a598b5-6732-4661-a0ae-bffeb0da48b9",
    "provider": "email",
    "email": "admin@example.com",
    "name": "Admin Matxa",
    "avatarUrl": "https://...",
    "phoneVerified": true,
    "role": "ADMIN",
    "status": "ACTIVE",
    "onboardingCompleted": true
  }
}
```

Web gửi access token ở mọi request bảo vệ:

```http
Authorization: Bearer <accessToken>
```

## 4. Current user / xác minh session

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Response là `AuthUser`, gồm `id`, `provider`, `email` nếu có, `name` nếu có, `avatarUrl` nếu có, `phoneNumber` nếu có, `phoneVerified`, `role`, `status`, `onboardingCompleted`.

API này không trả password hash, refresh-token hash, OTP secret hay dữ liệu identity nội bộ.

Web cần gọi endpoint này khi khởi tạo lại session. Chỉ cho render route Admin khi response có cả `role: "ADMIN"` và `status: "ACTIVE"`.

## 5. Refresh token

Khi access token hết hạn, dùng refresh token hiện có:

```http
POST /api/auth/refresh
Content-Type: application/json
```

```json
{ "refreshToken": "session-id.secret" }
```

Response là `AuthResponse` mới; refresh token được xoay vòng nên Web phải thay cả access token lẫn refresh token đang lưu. Nếu refresh thất bại, xóa session local và điều hướng login.

## 6. Authorization thực tế

Các controller `/api/admin/marketplace/**` dùng theo thứ tự:

1. `AccessTokenGuard`: cần Bearer token hợp lệ, session chưa revoke/chưa hết hạn và User `ACTIVE`.
2. `RolesGuard` với `@Roles('ADMIN')`: đọc lại role/status từ database cho mỗi request.

Do đó nếu account bị `BLOCKED` hoặc `DELETED`, session/token cũ bị `401` ngay từ AccessTokenGuard. Nếu account còn `ACTIVE` nhưng role là CUSTOMER/TECHNICIAN, request bị `403`.

## 7. Status và xử lý Web

| HTTP | Tình huống thực tế                                                                 | Web xử lý                                                           |
| ---: | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
|  401 | Thiếu token, token sai/hết hạn, session revoked/hết hạn, hoặc account không ACTIVE | Thử refresh một lần; nếu không thành công, xóa session và về login. |
|  403 | Đã đăng nhập nhưng không có role ADMIN                                             | Chặn route, hiển thị không có quyền; không retry.                   |
|  400 | DTO/validation không hợp lệ                                                        | Hiển thị lỗi theo field/form.                                       |

## 8. API Admin hiện có

Tất cả endpoint sau đều yêu cầu `Authorization: Bearer <accessToken>` của ADMIN:

| Method | Endpoint                             | Chức năng                                             |
| ------ | ------------------------------------ | ----------------------------------------------------- |
| POST   | `/api/admin/marketplace/categories`  | Tạo danh mục                                          |
| POST   | `/api/admin/marketplace/banners`     | Tạo banner                                            |
| POST   | `/api/admin/marketplace/promotions`  | Tạo mã khuyến mãi                                     |
| POST   | `/api/admin/marketplace/technicians` | Chuyển User thành KTV, tạo/xác minh TechnicianProfile |

Ví dụ API bảo vệ:

```http
POST /api/admin/marketplace/categories
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{ "name": "Massage trị liệu", "slug": "massage-tri-lieu", "sortOrder": 1 }
```

## 9. Flow Web

1. Mở Web Admin.
2. Nếu có session local, gọi `GET /api/auth/me`.
3. `401`: refresh token; refresh thất bại thì logout.
4. `403` hoặc `role !== ADMIN`: chặn Admin dashboard.
5. `ADMIN` + `ACTIVE`: render dashboard và gửi Bearer token cho admin API.
6. Logout gọi `POST /api/auth/logout` nếu cần revoke server session, sau đó xóa token local.

## 10. Route guard frontend

Các route như `/admin`, `/admin/users`, `/admin/bookings`, `/admin/technicians` phải guard bằng current user đã xác minh từ `/api/auth/me`. Không chỉ ẩn menu dựa vào dữ liệu cache/localStorage.

## 11. Environment / Base URL

Không hardcode URL production. React portal hiện dùng cùng origin với backend khi build production (`/api`). Local Vite proxy nhận biến:

```env
VITE_API_PROXY_TARGET=http://localhost:5600
```

Ví dụ để test với backend khác, thay giá trị trên bằng base URL của backend, không commit file `.env.local` chứa cấu hình riêng.

## 12. Những điều frontend không được làm

- Không tự set `role = ADMIN` trong browser hoặc gửi role trong login request.
- Không tin role cache nếu chưa gọi `/api/auth/me`.
- Không gửi `adminId` tùy ý; backend lấy admin từ access token.
- Không thực hiện admin action qua Marketplace public API.
- Không coi 403 là token hết hạn; chỉ refresh khi nhận 401.
