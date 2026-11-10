-- Technician city/district must be codes ("HN"), which search and matching filter on. An app once saved the name
-- ("Hà Nội") when its city list failed to load. Turn names that match the lists into their codes; anything else
-- (e.g. a city not in the list) is left as it is.
UPDATE technician_profiles p SET city = c.code
FROM cities c WHERE p.city IS NOT NULL AND p.city <> c.code AND lower(trim(p.city)) = lower(c.name);

UPDATE technician_applications a SET city = c.code
FROM cities c WHERE a.city IS NOT NULL AND a.city <> c.code AND lower(trim(a.city)) = lower(c.name);

UPDATE technician_profiles p SET district = d.code
FROM districts d WHERE p.district IS NOT NULL AND p.district <> d.code AND d.city_code = p.city
  AND lower(trim(p.district)) = lower(d.name);

UPDATE technician_applications a SET district = d.code
FROM districts d WHERE a.district IS NOT NULL AND a.district <> d.code AND d.city_code = a.city
  AND lower(trim(a.district)) = lower(d.name);
