-- Prepaid online bookings completed before the commission was fixed at take time: show the commission that was
-- actually recorded for the technician (technician_earnings), not 0.
UPDATE "bookings" b
SET "platform_fee" = e."commission",
    "technician_earning" = e."gross_amount" - e."commission" + COALESCE(b."service_fee", 0) + COALESCE(b."travel_fee", 0)
FROM "technician_earnings" e
WHERE e."booking_id" = b."id"
  AND b."mode" = 'ONLINE'
  AND COALESCE(b."platform_fee", 0) = 0;
