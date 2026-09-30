# Đăng ký KTV từ Mobile

## Flow

1. `POST /api/technician/application` tạo hồ sơ đăng ký lần đầu.
2. `GET /api/technician/application` lấy hồ sơ hiện tại.
3. `PATCH /api/technician/application` chỉnh sửa thông tin nháp.
3. Gọi `POST /api/technician/application/document-upload-url` ba lần với `ID_CARD_FRONT`, `ID_CARD_BACK`, `FACE`.
4. Upload file trực tiếp lên S3 bằng `uploadUrl`.
5. PATCH lại hồ sơ với ba `...Key` trả về.
6. `POST /api/technician/application/submit` gửi Admin duyệt.

Ảnh CCCD/khuôn mặt lưu private trên S3, không trả public URL.

## Upload request

```json
{
  "documentType": "ID_CARD_FRONT",
  "contentType": "image/jpeg",
  "size": 250000
}
```

Các loại: `ID_CARD_FRONT`, `ID_CARD_BACK`, `FACE`; tối đa 10 MiB/file.

## Hồ sơ

```json
{
  "displayName": "Nguyễn Văn A",
  "gender": "MALE",
  "city": "Hà Nội",
  "bio": "Có kinh nghiệm chăm sóc sức khỏe",
  "idCardFrontKey": "technician-applications/user-id/id_card_front/uuid.jpg",
  "idCardBackKey": "technician-applications/user-id/id_card_back/uuid.jpg",
  "faceImageKey": "technician-applications/user-id/face/uuid.jpg"
}
```

Hồ sơ phải đủ ba ảnh mới submit được. Trạng thái: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`.

Admin duyệt bằng `/api/admin/marketplace/technician-applications`; khi approve backend mới tạo/kích hoạt `TechnicianProfile` và chuyển user thành `TECHNICIAN`.
