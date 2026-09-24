# Marketplace API

All routes below retain the `/api` prefix and existing response structure. Tabs, filter chips and empty states use the same search endpoint. No extra screen-specific endpoints were added. This implements the supplied screen requirements; no Figma file URL was supplied for visual inspection.

## Endpoints

| Method/path | Behavior |
| --- | --- |
| GET `/api/marketplace/home` | Active, currently effective banners; active categories; up to 10 eligible technicians. Optional latitude/longitude. |
| GET `/api/marketplace/categories` | Active category IDs/names/slugs for tabs and filters. |
| GET `/api/marketplace/technicians` | Search, filter, sort and paginate technician cards. |
| GET `/api/marketplace/technicians/:id` | Existing detail format, now excludes inactive profiles/users and inactive services/categories. |
| GET `/api/marketplace/technicians/:id/availability` | Legacy from/to-only requests return working windows. With serviceIds and mode, returns computed future slots excluding PENDING/CONFIRMED bookings. Requires verified, active profiles/users. |

Home and search allow guests. Without Authorization, `isFavorite` is false. With a Bearer token, the existing access-token/session validation runs and favorites are scoped to its authenticated user. Invalid, expired or revoked supplied credentials return 401; remove Authorization to browse as a guest. A client-supplied userId is never trusted.

## Query DTO

`SearchTechniciansDto` in `src/modules/marketplace/dto/marketplace.dto.ts`:

| Query | Validation/meaning |
| --- | --- |
| search | Existing name search, up to 100 characters, case-insensitive literal substring |
| keyword | Alias; search takes precedence if supplied |
| gender | MALE / FEMALE / OTHER |
| tag | Existing single tag, up to 50 characters |
| tags | Comma-separated or repeated query values; 1–20 nonempty tags, each up to 50 characters; ALL requested tags must match |
| categoryId | UUID of ServiceCategory |
| serviceId | UUID of TechnicianService (a technician's own offering, not a global service type) |
| mode | HOME / ONSITE / ONLINE; matching service and profile must support it |
| available | Exactly true or false; false is no longer converted into true |
| latitude / longitude | Numbers in [-90,90] / [-180,180]; supply both or neither |
| sort | recommended (default), distance (requires coordinates), rating, availability; explicit sort overrides recommended ordering |
| page | Integer >=1, default 1 |
| limit | Integer 1–100, default 20 |

Home uses `MarketplaceHomeQueryDto` (latitude/longitude only) and always requests page 1, limit 10 internally.

The current category schema has no physical/mental parent-group relationship. Frontend must map those tabs to configured category IDs. No invented category IDs, demo seeds or name-based classification were introduced. If a tab must aggregate several categories, its exact mapping needs to be defined separately.

## Response DTO

`TechnicianListResponse = { items: TechnicianListItem[], total, page, limit }`.
`MarketplaceHomeResponse = { banners, categories, technicians: TechnicianListItem[] }`.
DTOs are in `src/modules/marketplace/entities/marketplace.entity.ts` and linked to Swagger.

Each card preserves the old field names:

```json
{
  "id": "<TechnicianProfile UUID>",
  "technicianId": "<same UUID as id>",
  "userId": "<user UUID>",
  "displayName": "<name or null>",
  "avatarUrl": null,
  "gender": "FEMALE",
  "tags": ["massage"],
  "serviceModes": ["HOME", "ONSITE"],
  "isVerified": true,
  "isAvailable": true,
  "averageRating": 4.5,
  "rating": 4.5,
  "supportedModes": ["HOME", "ONSITE"],
  "nextAvailableAt": null,
  "reviewCount": 12,
  "city": null,
  "startingPrice": 150000,
  "distanceKm": 2.3,
  "isFavorite": false
}
```

Prices/ratings/distances are numbers. Distance is rounded to 0.1 km for display, but ordering uses unrounded distance. Unknown location returns null, sorted last. Starting price is the minimum price of an active service matching the current category/service/mode filters. `isAvailable` is the technician's declared readiness, not a guarantee of an unoccupied booking slot. Quote remains authoritative for selected booking times. `isVerified=true` is mandatory for publication and new booking quotes/creation. Admin verification uses the existing POST /api/admin/marketplace/technicians endpoint.

Eligibility: user ACTIVE, profile isActive=true and isVerified=true and at least one matching active service in an active category. `isAvailable=false` does not mean the profile is disabled.

## Query logic

`MarketplaceService.searchTechnicians` uses parameterized `Prisma.sql` and `$queryRaw`, never interpolated SQL input:

1. Join technician_profiles to users; filter profile is_active, is_verified and user status.
2. Apply name/gender/tags/availability/profile mode.
3. A single EXISTS joins technician_services to service_categories and applies all service filters to the SAME active service. An inactive service cannot qualify a technician.
4. With location, compute Haversine great-circle distance using coordinates in PostgreSQL, sort distance ascending NULLS LAST, availability descending, rating descending, ID ascending. Without location, sort availability/rating/ID. ID breaks ties deterministically.
5. CTE count and LIMIT/OFFSET pagination run in PostgreSQL; no loading all technicians into Node. Count still returns the correct total for empty/out-of-range pages.
6. Hydrate only page IDs with Prisma, fetch matching active service prices/modes (ordered by price) and query favorites once for those IDs. A RepeatableRead transaction keeps page/count/details consistent.

The ranking query shape is:

```sql
WITH filtered AS (
  SELECT p.id, p.is_available, p.average_rating, <distance expression> AS distance
  FROM technician_profiles p JOIN users u ON u.id = p.user_id
  WHERE p.is_active = true AND p.is_verified = true AND u.status = 'ACTIVE'
    AND <parameterized profile filters>
    AND EXISTS (
      SELECT 1 FROM technician_services s
      JOIN service_categories c ON c.id = s.category_id
      WHERE s.technician_id = p.id AND s.is_active = true AND c.is_active = true
        AND <parameterized category/service/mode filters>
    )
), page AS (
  SELECT * FROM filtered ORDER BY <distance if supplied>, is_available DESC, average_rating DESC, id ASC
  LIMIT $limit OFFSET $offset
)
SELECT (SELECT COUNT(*) FROM filtered), <ordered page IDs and distances> FROM page;
```

## Schema and deployment

Migration `20260922090000_technician_profile_active` adds:

- `technician_profiles.is_active boolean NOT NULL DEFAULT true` (preserves existing profiles).
- B-tree `(is_active, is_available DESC, average_rating DESC, id)`.
- GIN index on `tags`.

Existing indexes on service `(technician_id,is_active)`, `(category_id,is_active)` and favorites `(user_id,technician_id)` remain useful. For larger datasets, consider pg_trgm for name substring search and PostGIS/geography indexes for nearby search after measuring query plans. The current exact-distance query still computes distance for all filtered candidates, but transfers only one page.

Admin's existing POST `/api/admin/marketplace/technicians` accepts optional boolean `isActive` when upserting a profile. Self-editing technician DTOs do not expose that field. Booking validation also checks profile/category activation so hidden profiles cannot be booked directly by ID.

Before deploying the new backend, run in backend:

```sh
npm run db:deploy
npm run db:generate
npm run build
```

Restart the backend afterwards. Migration execution against a server is not performed by this code change.

## Example requests

```http
GET /api/marketplace/home?latitude=10.7769&longitude=106.7009
GET /api/marketplace/technicians?search=Lan&gender=FEMALE&mode=HOME&available=true&page=1&limit=20
GET /api/marketplace/technicians?tags=massage,yoga&available=false
GET /api/marketplace/technicians?categoryId=<category-uuid>&serviceId=<technician-service-uuid>
GET /api/marketplace/technicians?latitude=10.7769&longitude=106.7009&page=2&limit=10
Authorization: Bearer <optional backend access token>
```

No results: `{ "items": [], "total": 0, "page": 1, "limit": 20 }`. An out-of-range page can have empty items but a nonzero total.

## Tests

Run `npm test -- --runInBand marketplace` for DTO/HTTP/optional-auth and query-construction tests, and `npm test -- --runInBand` for all regression tests. Database calls are mocked in these unit/HTTP tests; they do not prove SQL execution on PostgreSQL.

After applying migration to a test database, check active/blocked users, disabled profiles, inactive services/categories, combined category+mode matching, cheapest service, false availability, identical-distance ties, missing coordinates, empty pages, and favorites from two different accounts. Run home with and without a Bearer token and verify effective banner dates. No real customer data or demo fixtures are inserted by these tests.


## Publication policy update (2026-09-24)

No schema change or migration is needed for this update: isVerified already exists.
Unverified profiles are excluded from home/search/category/nearby, detail, favorites,
availability and quote/create validation. Existing booking history remains accessible.
No account is automatically verified. Technician self-edit cannot set isVerified.

Card rating is an additive alias of averageRating. supportedModes is the intersection
of profile modes and matching active service modes; legacy serviceModes is preserved.
nextAvailableAt is currently null: no service selection/duration exists on a card,
so the API does not claim that a working window is a bookable slot. Use the existing
availability endpoint after selecting services, then quote for the final check.

Existing indexes cover technician service (technicianId,isActive),
(categoryId,isActive), favorite primary key (userId,technicianId), profile active/sort,
tags GIN, and availability (technicianId,startAt,endAt). No duplicate index added.
If production EXPLAIN ANALYZE shows many unverified rows scanned, consider replacing
the profile active/sort index with (isActive,isVerified,isAvailable DESC,averageRating DESC,id).
A user-status-only index is not automatically useful for the existing primary-key join.

Swagger/Postman checks:
1. GET /api/marketplace/home with no Authorization: effective banners, active categories, <=10 cards.
2. GET /api/marketplace/technicians?mode=HOME&available=true&sort=rating&page=1&limit=10
3. GET /api/marketplace/technicians?latitude=10.77&longitude=106.69&sort=distance
4. Add categoryId/serviceId UUIDs and tags; the SAME active service must match every service filter.
5. Repeat with valid Bearer token: favorite flag belongs only to the authenticated user.
6. Invalid token =>401; invalid sort/UUID/pagination =>400; distance without coordinates =>400.
7. In a test database, unverify a profile, disable it, or block its user: it disappears from all listings;
   detail/availability =>404, quote rejects. Restore through the authorized admin flow.
8. Empty results/out-of-range page retain total/page/limit and items=[].

Tests use mocked Prisma queries and real HTTP validation/auth guards. They do not
execute the ranking SQL against a real PostgreSQL database or validate a deployed server.
