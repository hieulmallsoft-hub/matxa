# Mobile API: KTV nhận đơn

Base URL: `<apiOrigin>/api`  
Auth: `Authorization: Bearer <accessToken>` của tài khoản có role `TECHNICIAN`.

Đơn trong tab **Nhận việc** là booking mà khách đã đặt trực tiếp cho KTV trên Marketplace. Đây không phải job board công khai; KTV khác không thể xem hoặc nhận đơn đó.

## Màn danh sách đơn

```http
GET /technician/jobs?status=PENDING&page=1&limit=20
```

`status` nhận `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`. Dùng `PENDING` cho tab **Yêu cầu mới**.

Mỗi item trả `customer`, `address`, `items`, `totalAmount`, `startAt`, `endAt`, `jobState`, `canAccept`, `canDecline`, `canComplete`.

## Chi tiết đơn

```http
GET /technician/jobs/:bookingId
```

Mobile dùng `canAccept`, `canDecline`, `canComplete` để quyết định hiển thị nút, không tự suy luận chỉ từ status.

## Nhận đơn / “Ứng tuyển” theo Figma

```http
POST /technician/jobs/:bookingId/accept
```

Không có body. Backend atomically chuyển `PENDING` sang `CONFIRMED`, đồng thời thông báo cho khách. Nếu đơn đã bị hủy hoặc đã đổi trạng thái, Mobile nhận `409` và phải tải lại danh sách.

## Từ chối đơn

```http
POST /technician/jobs/:bookingId/decline
Content-Type: application/json

{ "reasonCode": "OTHER", "reasonText": "Không thể phục vụ trong khung giờ này" }
```

Chỉ từ chối được khi `PENDING`. Backend hủy đơn và thông báo khách.

## Hoàn thành đơn

```http
POST /technician/jobs/:bookingId/complete
```

Không body. Chỉ được gọi khi đơn `CONFIRMED` và đã qua `endAt`.

## Gọi khách và chat

Sau khi nhận đơn thành công, lấy số điện thoại:

```http
GET /technician/jobs/:bookingId/contact
```

Response:

```json
{ "bookingId": "<uuid>", "displayName": "Thu Hương", "phoneNumber": "+84901234567" }
```

Endpoint trả `403` trước khi KTV nhận đơn. Nút chat dùng `customer.id` từ job detail cùng API Conversations hiện có.

## Error states

| HTTP | Mobile xử lý                                                    |
| ---- | --------------------------------------------------------------- |
| 401  | Refresh token hoặc yêu cầu đăng nhập lại.                       |
| 403  | Chưa là KTV đã duyệt, hoặc chưa nhận đơn nhưng cố lấy số khách. |
| 404  | Đơn không thuộc KTV / khách chưa xác thực số điện thoại.        |
| 400  | Sai trạng thái, ví dụ hoàn thành trước giờ kết thúc.            |
| 409  | Đơn vừa bị hủy hoặc xử lý từ thiết bị khác; refresh Job Inbox.  |
