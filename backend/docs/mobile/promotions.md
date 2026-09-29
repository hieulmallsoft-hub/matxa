# Promotions API - Mobile Integration

## 1. Màn hình sử dụng

- Màn hình **Ưu đãi**: xem voucher đang hoạt động.
- Màn hình thanh toán booking: chọn `code` rồi gửi vào Quote.
- Không có endpoint apply voucher riêng và hiện chưa có promotion detail riêng.

## 2. Flow Mobile

```text
GET /api/marketplace/promotions
→ người dùng chọn code
→ POST /api/bookings/quote với promotionCode
→ backend validate và trả discount/total
→ POST /api/bookings gửi lại promotionCode
```

Quote và Create Booking là source of truth cuối cùng; list chỉ dùng để hiển thị/chọn voucher.

## 3. Authentication

`GET /api/marketplace/promotions` yêu cầu Bearer access token vì backend kiểm tra giới hạn sử dụng theo user. Quote và Create Booking cũng yêu cầu Bearer access token.

## 4. Endpoints thực tế

### Danh sách voucher Mobile

`GET /api/marketplace/promotions?page=1&limit=20`

Chỉ trả promotion đang `isActive=true`, `startsAt <= now`, `endsAt >= now`. Kết quả sắp xếp voucher sắp hết hạn trước, sau đó mới tạo gần nhất.

### Quote

`POST /api/bookings/quote`

Ví dụ request:

```json
{
  "technicianId": "technician-profile-id",
  "serviceIds": ["technician-service-id"],
  "mode": "HOME",
  "addressId": "address-id",
  "scheduledStart": "2026-10-01T10:00:00+07:00",
  "promotionCode": "WELCOME50"
}
```

### Create Booking

`POST /api/bookings`

Gửi lại `promotionCode` trong body cùng các field booking. Không gửi `discountAmount`, `totalAmount` hoặc `usedCount` để backend tin.

## 5. Promotion response

```json
{
  "items": [
    {
      "id": "promotion-id",
      "code": "WELCOME50",
      "name": "Giảm 50K",
      "type": "FIXED",
      "value": 50000,
      "minOrderAmount": 300000,
      "maxDiscount": null,
      "startsAt": "2026-09-01T00:00:00.000Z",
      "endsAt": "2026-10-01T00:00:00.000Z",
      "isActive": true,
      "availabilityStatus": "AVAILABLE",
      "isEligible": true,
      "ineligibilityReason": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

Field mapping:

- `id`: ID nội bộ promotion.
- `code`: mã gửi lại trong Quote/Create Booking.
- `name`: tên hiển thị.
- `type`: `FIXED` hoặc `PERCENT` theo enum backend.
- `value`: số tiền VND nếu `FIXED`, phần trăm nếu `PERCENT`.
- `maxDiscount`: mức giảm tối đa, null nếu không giới hạn.
- `minOrderAmount`: subtotal tối thiểu để dùng mã.
- `startsAt`, `endsAt`: thời gian hiệu lực ISO UTC.
- `availabilityStatus`: `AVAILABLE` hoặc `USAGE_EXHAUSTED` tại thời điểm lấy list.
- `isEligible`: chỉ phản ánh giới hạn sử dụng hiện tại; điều kiện subtotal/service chỉ kết luận ở Quote.
- `ineligibilityReason`: hiện có `USAGE_EXHAUSTED` hoặc null.

## 6. Discount type và điều kiện

- `FIXED`: `value=50000` nghĩa là giảm 50.000 VND.
- `PERCENT`: `value=10` nghĩa là giảm 10% subtotal.
- `maxDiscount` được áp dụng nếu có.
- `minOrderAmount` được kiểm tra trên subtotal dịch vụ.
- `usageLimit` và `usedCount` là dữ liệu nội bộ, không trả cho Mobile.
- `perUserLimit` được kiểm tra theo user hiện tại; list có thể trả `USAGE_EXHAUSTED` nếu user đã dùng hết.
- Schema hiện chưa có rule áp dụng riêng theo category/service/technician; không hiển thị điều kiện đó trên Mobile.

## 7. Chọn voucher

Mobile chỉ cần giữ `promotionCode`. Không tự tính discount, không tạo API apply riêng và không consume voucher khi chỉ mở list hoặc gọi Quote.

## 8. Quote và Create Booking

Quote kiểm tra lại:

- tồn tại và code chuẩn hóa uppercase;
- active và thời gian hiệu lực;
- usage limit và per-user limit;
- minimum order;
- tính discount và giới hạn max discount.

Create Booking chạy Quote lại trong transaction, sau đó atomically tăng `usedCount` và tạo `PromotionUsage`. Nếu tạo booking thất bại, transaction rollback usage.

## 9. Voucher có thể hết giữa chừng

List lúc 10:00 có thể trả `AVAILABLE`, nhưng đến lúc Quote hoặc Create Booking voucher đã hết lượt. Mobile phải coi lỗi đó là bình thường: bỏ trạng thái đã chọn, hiển thị message backend và cho người dùng chọn mã khác.

## 10. UI state

- Loading: skeleton danh sách voucher.
- Empty: hiển thị chưa có ưu đãi phù hợp.
- Success: hiển thị tên, code, mức giảm, đơn tối thiểu và hạn dùng.
- Unavailable: disable voucher có `isEligible=false`.
- Quote loading: disable nút xác nhận và dùng discount/total từ response backend.
- Error: giữ màn hình để thử lại, nhưng không giữ voucher sau khi Quote reject vì voucher không hợp lệ.

## 11. Error handling

- `400 Ma khuyen mai khong hop le hoac da het han`: mã sai, inactive hoặc hết hạn → bỏ mã, cho chọn lại.
- `400 Ma khuyen mai da het luot su dung`: hết usage tổng hoặc per-user → bỏ mã và tải lại list.
- `400 Don hang chua dat gia tri toi thieu`: hiển thị số tiền tối thiểu và cập nhật Quote.
- `400` do service, technician, address hoặc slot: xử lý theo lỗi booking tương ứng; không coi voucher là đã consume.
- `401`: refresh token hoặc đăng nhập lại.
- `429`: chờ rate limit rồi thử lại.
- `5xx`: cho phép thử lại, không tự hiển thị discount cũ như kết quả chắc chắn.

## 12. Tiền tệ

Backend trả số nguyên VND trong Quote (`discountAmount`, `totalAmount`, cùng alias `discount`, `total`). Mobile chỉ format tiền để hiển thị, không làm tròn hoặc tự tính lại.

## 13. Mobile không được làm

- Không tự tính discount làm source of truth.
- Không gửi `usedCount` hoặc giả lập usage.
- Không consume voucher khi chỉ lấy list hoặc Quote.
- Không coi list là bảo đảm voucher sẽ dùng được lúc Create Booking.
- Không gửi `discountAmount`/`totalAmount` để backend tin.
- Không giữ voucher vĩnh viễn sau khi Quote thất bại.
- Không hiển thị category/service applicability vì schema hiện chưa hỗ trợ rule này.
