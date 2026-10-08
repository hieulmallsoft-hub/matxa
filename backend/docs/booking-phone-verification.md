# Phone number and booking

Creating a DIRECT booking (`POST /api/bookings`) or OPEN booking (`POST /api/bookings/open`) no longer requires SMS OTP verification.

If Mobile asks a customer to add or change a number, it must show one confirmation popup and then call `PATCH /api/profile/me` with `phoneNumber`. The server validates and normalizes the Vietnamese number, and refuses a number already linked to another account.

Legacy phone OTP endpoints remain available for existing login or account-linking flows. They are not part of the booking prerequisite.
