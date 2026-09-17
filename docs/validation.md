# Validation

The official archive was inspected on 17 September 2026. Its Metro Train feed has explicit type-4 records and no type-5 records. The fixture proves the key UI semantics: Southern Cross → Flinders Street → City Loop → Craigieburn remains zero transfers only when an explicit type-4 relationship exists.

Not verified: a current real-world Southern Cross → Craigieburn through-running instance. The importer still needs to persist the downloaded snapshot and run a fixture-like record query before this can be claimed.
