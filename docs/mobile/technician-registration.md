# Đăng ký kỹ thuật viên

## Quy tắc nghiệp vụ

Tài khoản vẫn là `CUSTOMER` sau khi gửi hồ sơ. Chỉ Admin duyệt thành công mới chuyển role thành `TECHNICIAN` và cho phép xuất hiện trên Marketplace.

## Flow

1. Tạo hồ sơ nháp: `POST /api/technician/application`.
2. Lưu thông tin hồ sơ: `PATCH /api/technician/application`.
3. Lấy presigned URL private để upload CCCD/khuôn mặt: `POST /api/technician/application/document-upload-url`.
4. Upload trực tiếp file lên S3 bằng URL nhận được.
5. Gửi key đã upload trong `PATCH`.
6. Gửi duyệt: `POST /api/technician/application/submit`.
7. Theo dõi `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` bằng `GET /api/technician/application`.

## Auth

Các endpoint Mobile yêu cầu `Authorization: Bearer <accessToken>`. Ảnh KYC không được đưa vào API Marketplace; chỉ Admin được cấp presigned URL xem tạm thời.

## Hồ sơ mẫu

```json
{
  "displayName": "Nguyễn Văn An",
  "gender": "MALE",
  "applicationType": "MASSAGE",
  "city": "Hà Nội",
  "district": "Cầu Giấy",
  "supportedModes": ["HOME", "ONSITE"],
  "facility": "Có phòng riêng",
  "bio": "5 năm kinh nghiệm massage trị liệu"
}
```

## KYC

Upload đủ `ID_CARD_FRONT`, `ID_CARD_BACK`, `FACE`. Key phải nằm dưới prefix do backend cấp, không tự tạo URL public. KYC được lưu private trên S3. Nếu bị `REJECTED`, Mobile hiển thị lý do và cho phép sửa/gửi lại.

## Dịch vụ và giá

Mỗi dịch vụ có thể có nhiều `priceOptions` theo category, ví dụ 60/90/120 phút hoặc 2/4/6 tiếng. Mobile không được giả định một service chỉ có một giá và một thời lượng.

## State UI

- `DRAFT`: cho phép chỉnh sửa.
- `SUBMITTED`, `UNDER_REVIEW`: chỉ đọc, hiển thị đang chờ duyệt.
- `APPROVED`: hiển thị đã được duyệt; bắt đầu quản lý dịch vụ/availability.
- `REJECTED`: hiển thị `rejectionReason`, cho phép chỉnh sửa và gửi lại.

Không tự đổi role ở Mobile, không public ảnh CCCD/khuôn mặt, không cho đặt dịch vụ khi hồ sơ chưa `APPROVED`.
