# Booking with Price Options

Use active `priceOptions` returned in each service from:

```text
GET /api/marketplace/technicians/<technicianId>
```

For Availability, send `priceOptionIds` in the same order as `serviceIds`:

```text
GET /api/marketplace/technicians/<technicianId>/availability?serviceIds=<technicianServiceId>&priceOptionIds=<priceOptionId>&mode=HOME&date=2026-10-02
```

For Quote and Create Booking:

```json
{
  "technicianId": "<technicianId>",
  "serviceIds": ["<technicianServiceId>"],
  "priceOptionIds": ["<priceOptionId>"],
  "mode": "HOME",
  "scheduledStart": "2026-10-02T02:00:00.000Z",
  "addressId": "<addressId>"
}
```

The server rejects an inactive option or an option that belongs to another service. It calculates duration, price and booking snapshots from database data, never from client price fields.
