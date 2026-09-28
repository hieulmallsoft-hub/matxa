# Availability API - Mobile Integration

## 1. Chức năng và màn hình sử dụng

Dùng sau khi user chọn Technician và một hay nhiều dịch vụ, tại màn chọn ngày/giờ. API chỉ hiển thị slot; không tạo booking và không giữ slot.

## 2. Authentication

Availability là public, không cần Bearer token. Mobile vẫn có thể gửi token hợp lệ nhưng response không thay đổi theo user.

## 3. Endpoint

| Method | Endpoint | Chức năng | Auth |
| --- | --- | --- | --- |
| GET | `/api/marketplace/technicians/:id/availability` | Working schedule legacy hoặc computed bookable slots | Public |

`:id` là **TechnicianProfile.id**, không phải User.id.

## 4. Request và query params

Computed slots cần:

```http
GET /api/marketplace/technicians/<TechnicianProfile.id>/availability?date=2026-10-01&technicianServiceIds=<TechnicianService.id-1>,<TechnicianService.id-2>&mode=HOME
```

| Query | Validation | Ý nghĩa |
| --- | --- | --- |
| `date` | `YYYY-MM-DD` | Ngày local theo Asia/Ho_Chi_Minh; exclusive với from/to |
| `technicianServiceIds` | UUID v4, 1–10, comma/repeated | Preferred ID service đúng contract booking |
| `serviceIds` | UUID v4, 1–10 | Alias cũ của technicianServiceIds; không gửi cả hai |
| `mode` | HOME/ONSITE/ONLINE | Bắt buộc khi lấy computed slots |
| `stepMinutes` | integer 5–120, default 30 | Khoảng chia slot, neo từ start của working interval |
| `from`, `to` | ISO có Z hoặc offset | Legacy range, gửi đủ cả hai, max 31 ngày |

Mọi selected service phải thuộc KTV, active, category active, KTV public/verified và hỗ trợ `mode`. Backend tự đọc duration từ database, không nhận duration từ mobile.

## 5. Response

```json
{
  "technicianId": "technician-profile-uuid",
  "date": "2026-10-01",
  "technicianServiceIds": ["technician-service-uuid-1", "technician-service-uuid-2"],
  "serviceIds": ["technician-service-uuid-1", "technician-service-uuid-2"],
  "mode": "HOME",
  "timezone": "Asia/Ho_Chi_Minh",
  "from": "2026-09-30T17:00:00.000Z",
  "to": "2026-10-01T17:00:00.000Z",
  "durationMinutes": 120,
  "totalDurationMinutes": 120,
  "stepMinutes": 30,
  "slots": [
    {
      "startAt": "2026-10-01T01:00:00.000Z",
      "endAt": "2026-10-01T03:00:00.000Z"
    }
  ]
}
```

`totalDurationMinutes` là tổng `durationMinutes` DB của các service distinct được chọn; `durationMinutes` là alias. `slots.startAt`/ `endAt` serialize ISO UTC có hậu tố `Z`. Dùng `timezone=Asia/Ho_Chi_Minh` để hiển thị cho người dùng Việt Nam: `01:00Z` là 08:00 giờ Việt Nam. `slots=[]` là trạng thái hết giờ, không phải error.

## 6. Cách backend tạo slot

Backend lấy working interval, tổng duration và tất cả booking PENDING/CONFIRMED overlap range trong hai query song song. Slot chỉ được trả khi start đến end nằm hoàn toàn trong một working interval, không overlap booking, và start ở tương lai. CANCELLED/COMPLETED không block. Không có query theo từng slot.

## 7. Flow Mobile

1. Từ Technician Detail, user chọn một/nhiều `technicianServiceId`.
2. User chọn mode HOME/ONSITE/ONLINE.
3. User chọn date theo giờ Việt Nam.
4. Gọi Availability với `date`, `technicianServiceIds`, `mode`.
5. User chọn một slot, dùng `startAt` làm `scheduledStart` trong Quote.
6. Quote thành công mới cho user Create Booking.
7. Nếu Create Booking báo slot vừa bị chiếm, refresh Availability và Quote lại.

Availability không giữ slot. Không dùng response này như guarantee giữa lúc xem và lúc create.

## 8. Loading, empty và error state

- Loading: disable chọn giờ hoặc hiển thị skeleton khi date/service/mode đổi.
- Empty: `slots=[]` hiển thị “Không còn giờ phù hợp”, cho đổi ngày/service/mode.
- Success: chỉ cho chọn `slots[].startAt`, không tự sinh slot phía client.
- Error: giữ selection; nếu service hoặc KTV không còn public, quay về Detail/List để refetch.

## 9. Error Codes và xử lý

| HTTP | Message/code thực tế | Mobile xử lý |
| --- | --- | --- |
| 400 | `Can date hoac ca from va to` | Gửi date hoặc đủ from/to. |
| 400 | `Chi truyen date hoac from/to` | Không gửi date cùng from/to. |
| 400 | `Khoang ngay khong hop le, toi da 31 ngay` | Sửa date/range. |
| 400 | `Can serviceIds va mode de lay slot trong` | Chọn service và mode trước. |
| 400 | `Can mode de lay slot trong` | Gửi mode hợp lệ. |
| 400 | `Chi gui serviceIds hoac technicianServiceIds` | Chỉ dùng một field ID service. |
| 400 | `Co dich vu khong hop le hoac ky thuat vien khong con hoat dong` | Refetch Detail, bỏ service cũ. |
| 400 | `Dich vu khong ho tro hinh thuc da chon` | Đổi mode hoặc service. |
| 404 | `Ky thuat vien khong ton tai` | Quay lại List và refetch. |

## 10. Ví dụ request hoàn chỉnh

```http
GET /api/marketplace/technicians/11111111-1111-4111-8111-111111111111/availability?date=2026-10-01&technicianServiceIds=22222222-2222-4222-8222-222222222222,33333333-3333-4333-8333-333333333333&mode=HOME&stepMinutes=30
```

## 11. Những điều Mobile KHÔNG được làm

- Không gửi User.id thay TechnicianProfile.id.
- Không gửi master service ID hoặc client duration/price.
- Không gửi cả `serviceIds` và `technicianServiceIds`.
- Không tự bỏ booking overlap hay tự sinh slot.
- Không hiển thị startAt UTC như giờ local mà không convert theo timezone.
- Không coi Availability là giữ chỗ; phải Quote/Create và xử lý slot bị chiếm.
