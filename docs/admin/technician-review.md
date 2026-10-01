# Admin Technician Review Integration

All endpoints require an Admin bearer token.

## Application lifecycle

`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` or `REJECTED`.

Only `SUBMITTED` and `UNDER_REVIEW` applications can be approved or rejected. Approval changes the user role to `TECHNICIAN` in one database transaction.

## Endpoints

```text
GET  /api/admin/marketplace/technician-applications
GET  /api/admin/marketplace/technician-applications/<applicationId>
POST /api/admin/marketplace/technician-applications/<applicationId>/review
POST /api/admin/marketplace/technician-applications/<applicationId>/approve
POST /api/admin/marketplace/technician-applications/<applicationId>/reject
```

Reject request:

```json
{ "reason": "CCCD can chup lai ro hon" }
```

Application detail is Admin-only because it includes KYC storage metadata. Never expose this response through public Marketplace endpoints.
