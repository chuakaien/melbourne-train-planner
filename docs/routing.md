# Routing approach

The initial engine is a correctness-first, time-dependent connection scan over trips active on the Melbourne service date. It follows ordered `stop_times`, uses calendars and exceptions, and reconstructs the passenger sequence. A same-trip continuation has no transfer. An explicit trip-to-trip `transfer_type=4` continuation also has no transfer and is labelled “Stay on this train”. Type 5 is never treated as an in-seat continuation.

The next production iteration should load these normalized records from PostgreSQL and add bounded normal-transfer rounds (RAPTOR-style), then rank by arrival, physical transfers, waiting time and simplicity.
