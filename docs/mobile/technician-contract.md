# Hợp đồng KTV và ký điện tử

Hợp đồng được tạo sau khi hồ sơ KTV đã `APPROVED`. Backend lấy số điện thoại đã xác thực và số CCCD trong hồ sơ, sau đó lưu một snapshot để nội dung hợp đồng không đổi theo Profile về sau.

## KTV

```http
GET /api/technician/contract
POST /api/technician/contract/signature-upload-url
POST /api/technician/contract/sign
```

Lấy URL upload chữ ký:

```json
{ "contentType": "image/png", "size": 12000 }
```

Upload bytes trực tiếp lên `uploadUrl`, sau đó gửi key:

```json
{ "signatureKey": "technician-contracts/<userId>/signatures/<file>.png" }
```

KTV chỉ nhận số CCCD và số điện thoại đã che. Không gửi lại số đầy đủ từ mobile.

## Admin

```http
GET   /api/admin/technician-contracts
PATCH /api/admin/technician-contracts/{id}/review
GET   /api/admin/technician-contracts/{id}/download-url
```

Duyệt:

```json
{ "status": "APPROVED" }
```

Từ chối:

```json
{ "status": "REJECTED", "reason": "Thông tin cần bổ sung" }
```

Khi duyệt, backend lưu snapshot hợp đồng đã ký vào S3 private và cấp signed URL tạm thời cho Admin. Ảnh chữ ký và bản hợp đồng không được public.
