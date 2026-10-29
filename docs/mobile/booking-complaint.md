# Khiếu nại booking

Khách chỉ gửi khiếu nại cho booking của chính mình sau khi booking `COMPLETED` hoặc `CANCELLED`. Mỗi booking chỉ được tạo một khiếu nại.

## Upload ảnh minh chứng (tùy chọn)

```http
POST /api/bookings/{bookingId}/complaint-evidence-upload-url
```

```json
{ "contentType": "image/jpeg", "size": 524288 }
```

Upload file vào `uploadUrl` nhận được, giữ lại `storageKey`.

## Gửi khiếu nại

```http
POST /api/bookings/{bookingId}/complaint
```

```json
{
  "reasonCode": "TECHNICIAN_BEHAVIOR",
  "detail": "Mô tả vấn đề gặp phải",
  "contactEmail": "customer@example.com",
  "evidenceStorageKeys": ["booking-complaint/.../image.jpg"]
}
```

`reasonCode` nhận: `SERVICE_ISSUE`, `TECHNICIAN_NO_CONTACT`, `TECHNICIAN_BEHAVIOR`, `SAFETY_ISSUE`, `PAYMENT_ISSUE`, `OTHER`.

Response trả `id`, `bookingId`, `reasonCode`, `status` (`SUBMITTED`), nội dung và danh sách minh chứng. Backend kiểm tra quyền sở hữu booking, trạng thái booking, định dạng/kích thước ảnh và chống gửi trùng.

## API admin xử lý khiếu nại

Admin xem danh sách khiếu nại:

```http
GET /api/admin/complaints?status=SUBMITTED
```

`status` là tùy chọn: `SUBMITTED`, `IN_REVIEW`, `RESOLVED` hoặc `REJECTED`.

Admin cập nhật trạng thái:

```http
PATCH /api/admin/complaints/{complaintId}/status
```

```json
{ "status": "IN_REVIEW" }
```

Chỉ tài khoản có role `ADMIN` được gọi hai API này. Backend trả kèm booking, khách hàng và danh sách ảnh minh chứng để admin xử lý.
