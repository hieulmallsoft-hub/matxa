# Điều khoản và chính sách

Màn "Điều khoản và chính sách" (cả app khách và app KTV) lấy danh sách văn bản từ server. Admin đăng mỗi văn bản
dưới dạng **file PDF** trên web Admin (*Hệ thống → Điều khoản & Chính sách*); đăng lại cùng văn bản = **phiên bản mới**
(`v2.0`, `v3.0`…). App **không viết cứng** nội dung hay số phiên bản nữa.

Hai API **không cần đăng nhập** (văn bản phải xem được cả trước khi đăng ký/đăng nhập).

## 1. Danh sách văn bản

```http
GET /api/legal-documents?audience=TECHNICIAN
```

`audience`: `TECHNICIAN` (app KTV) hoặc `CUSTOMER` (app khách). Kết quả gồm văn bản riêng cho đối tượng đó **và**
văn bản chung. Bỏ `audience` = tất cả.

```json
[
  { "code": "TECHNICIAN_TERMS", "title": "Điều khoản dịch vụ đối với kỹ thuật viên", "audience": "TECHNICIAN",
    "version": 1, "versionLabel": "1.0", "fileName": "dieu-khoan-ktv.pdf", "updatedAt": "2026-11-05T03:00:00.000Z" },
  { "code": "PRIVACY_POLICY", "title": "Chính sách bảo mật và bảo vệ dữ liệu cá nhân", "audience": "ALL",
    "version": 2, "versionLabel": "2.0", "fileName": "chinh-sach-bao-mat.pdf", "updatedAt": "2026-11-05T03:05:00.000Z" }
]
```

Mỗi dòng: `title` bên trái, `v{versionLabel}` bên phải (ví dụ `v2.0`), giống thiết kế hiện tại. Danh sách đã sắp
theo thứ tự admin đặt. Danh sách rỗng → hiện "Chưa có văn bản".

## 2. Mở một văn bản

```http
GET /api/legal-documents/{code}
```

```json
{
  "code": "PRIVACY_POLICY", "title": "Chính sách bảo mật và bảo vệ dữ liệu cá nhân",
  "version": 2, "versionLabel": "2.0", "fileName": "chinh-sach-bao-mat.pdf", "updatedAt": "…",
  "downloadUrl": "https://…", "expiresIn": 600
}
```

Mở `downloadUrl` bằng trình xem PDF trong app (giống màn hợp đồng). Link **hết hạn sau 600 giây**: mỗi lần mở văn bản
thì gọi lại API này, không lưu link. `404` = văn bản đã bị admin ẩn → tải lại danh sách.

## Mã văn bản đang dùng

| `code` | Tên | Hiện cho |
|---|---|---|
| `TECHNICIAN_TERMS` | Điều khoản dịch vụ đối với kỹ thuật viên | KTV |
| `PRIVACY_POLICY` | Chính sách bảo mật và bảo vệ dữ liệu cá nhân | Khách & KTV |
| `OPERATING_RULES` | Quy chế hoạt động | Khách & KTV |
| `DATA_PROTECTION_AGREEMENT` | Thỏa thuận bảo vệ thông tin và bảo mật dữ liệu cá nhân | Khách & KTV |
| `TERMS_OF_USE` | Điều khoản sử dụng | Khách & KTV |

Admin có thể thêm văn bản khác; app chỉ cần hiển thị đúng danh sách API trả về, không cần biết trước mã.
Nếu có chỗ khác trong app trỏ thẳng tới một văn bản (ví dụ link "Chính sách bảo mật" ở màn đăng ký), gọi
`GET /api/legal-documents/PRIVACY_POLICY`.
