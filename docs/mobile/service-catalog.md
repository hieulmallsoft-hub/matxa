# Service catalog for OPEN booking

`GET /api/service-catalog?categoryId=&mode=HOME&search=` returns active platform services only.

Each item has `id`, `category`, `name`, `supportedModes`, `pricingTemplate`, and active `priceOptions`. Render the option durations/prices returned by the API; do not infer them from category names.

Create an OPEN booking with the selected catalog service and option IDs:

```json
{ "items": [{ "catalogServiceId": "uuid", "priceOptionId": "uuid" }], "mode": "HOME", "city": "HN", "scheduledStart": "2026-10-03T08:00:00Z", "paymentMethod": "CASH" }
```

Never send `TechnicianService.id` to `/bookings/open`.
