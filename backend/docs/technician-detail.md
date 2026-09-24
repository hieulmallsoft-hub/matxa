# Technician detail

GET /api/marketplace/technicians/:id remains public with optional Bearer authentication.
:id is TechnicianProfile.id. Optional latitude and longitude must be supplied together.
Unknown, unverified, disabled, locked-account and service-less profiles all return 404.
Guest isFavorite=false; authenticated favorite uses only the current session user.

The complete response example is technician-detail.example.json (documentation only).
New service fields: categoryName, supportedModes. Existing modes and nested category remain.
serviceId remains a legacy alias of technicianServiceId, NOT a master service ID.
Pass services[].technicianServiceId in booking serviceIds for quote/create.
Detail supportedModes is the union of ALL returned active services in active categories.
Legacy serviceModes retains the profile configuration. Quote also validates profile mode:
admins/technicians should keep profile and service configurations consistent.
onsiteLocation uses the profile address only when active services support ONSITE.
No customer address, meeting link, booking creation or slot reservation occurs here.

Missing schema: separate gallery/images, experienceYears, tipping policy/safety/professional
badges, a separate Facility entity/facilityId/name/district, a master Service entity,
and review visibility/deletion status. No such fields/entities were invented.
Existing images is an avatar-only fallback, not a real gallery. Tags and verified are real fields.
Existing public profile coordinates retain Decimal string serialization; onsiteLocation uses numbers.
nextAvailableAt=null until services/duration are chosen and availability is queried.

Rating uses the stored profile aggregate. The existing review write path creates the review,
aggregates ALL technician reviews, and updates rating/count in one Serializable transaction,
retrying serialization conflicts up to three attempts. The embedded 20 newest reviews are
not used to recalculate the total rating. No review edit/delete path or status exists today.
Direct database edits/imports that bypass this transaction can still require aggregate repair.

Performance/security: one profile query with nested services/categories and at most 20 reviews,
plus at most one current-user favorite query. No per-service/per-review query loop or N+1.
Profile scalar selection is explicit; technician and review users select only id/displayName/avatarUrl.
Existing category/service/review fields remain compatible. No schema/index/migration changes.

Tests: guest and authenticated HTTP access, favorite true/false, private fields excluded,
profile ID distinct from user ID, mode union, active service/category filtering,
20 newest reviews with stable ordering, all publication denial cases, booking aggregate retry.
Prisma is mocked (including a query-aware detail fixture); real database execution is not claimed.

Swagger/Postman:
- GET /api/marketplace/technicians/{TechnicianProfile.id}, no Authorization => public detail.
- Repeat with a valid Bearer token after adding favorite => isFavorite=true.
- Add ?latitude=10.77&longitude=106.69 => distance; no coords => distanceKm=null.
- Test unverified/inactive/blocked/service-less records in a test database =>404.
- Copy services[0].technicianServiceId into quote serviceIds, choose its mode and future time.
