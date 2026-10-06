# Admin booking financial snapshot

`GET /api/admin/bookings` có `financials` cho reconciliation:

```json
{
  "subtotal": 500000,
  "serviceFee": 100000,
  "discountAmount": 0,
  "totalAmount": 600000,
  "financials": {
    "grossServiceAmount": 500000,
    "platformFee": 0,
    "technicianEarning": 500000,
    "customerPayableAmount": 600000,
    "feePolicyVersion": "ZERO_V1",
    "currency": "VND"
  }
}
```

`grossServiceAmount` là giá dịch vụ; `serviceFee` là phí phục vụ tại nhà hiện có; `discountAmount` là ưu đãi customer; `totalAmount`/`customerPayableAmount` là số customer thanh toán. Không suy luận rằng customer total bằng KTV earning.

Policy hiện tại `ZERO_V1` chỉ là snapshot architecture an toàn: fee platform = 0, HOME fee và promotion chưa được phân bổ vào KTV earning. Các booking cũ để `null`, không backfill bằng công thức phỏng đoán. Khi có chính sách fee chính thức, tạo version mới; không reprice booking cũ.
