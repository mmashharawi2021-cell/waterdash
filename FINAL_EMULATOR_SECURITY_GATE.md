# WATERDASH Final Emulator Security Gate

## Scope and candidate

- `BRANCH=fix/production-blockers-20260823`
- `START_SHA=be1f98e09633ac8072234ab453ce38cf17eba0e9`
- `FINAL_SHA=6fadc97863e1029198a188351151db6c483087c3`
- `BASELINE_MAIN_SHA=d4de10b`
- `UNIFIED_REPORT_FUEL_REFERENCE=fix/unified-report-fuel-accounting@5941dd2`
- `OBSOLETE_BRANCH=fix/full-system-stabilization`
- `OBSOLETE_BRANCH_MERGED_DURING_GATE=false` (it is already an ancestor of `main` and was not used as an integration source)
- `BACKUP_BRANCH=backup/pre-full-system-stabilization-20260822` (preserved)

This gate was run only against the local Firebase Auth and Firestore emulators
on `127.0.0.1:9099` and `127.0.0.1:8080`. No production Firebase project,
data, rules, authentication endpoint, deployment target, merge, or push was
accessed.

## Emulator diagnosis and recovery

- `EMULATOR_SETUP=PASS`
- `AUTH_EMULATOR=PASS`
- `FIRESTORE_EMULATOR=PASS`
- `LOCAL_TRAFFIC_PROOF=PASS`

The prior apparent zero-byte Firestore emulator download was not a bad cached
JAR or an emulator configuration failure. Firebase CLI's Node streaming
download established HTTPS but stalled before writing its response body; the
earlier process was stopped while the file was still incomplete.

Local diagnostics found no configured proxy, sufficient disk space, and a
working Java 21 runtime. A one-megabyte ranged HTTPS request to the official
Firebase artifact endpoint succeeded. The exact official Firestore Emulator
v1.22.0 JAR was then downloaded locally, verified before use, and placed in
the Firebase CLI emulator cache:

- `ARTIFACT=cloud-firestore-emulator-v1.22.0.jar`
- `SIZE=136707194 bytes`
- `MD5=5d74cc6bee9e18560d2eae2c6440fd13`
- `CACHE=C:\Users\mozar\.cache\firebase\emulators\cloud-firestore-emulator-v1.22.0.jar`

The checksum matches the Firebase CLI artifact metadata. Both emulators then
started normally, and every security test connected only to loopback.

## Security gate

- `P0_BLOCKER_STATUS=CLOSED`
- `ROLE_CLAIMS=PASS`
- `SELF_ASSIGN_PRIVILEGE_ESCALATION=BLOCKED`
- `INVALID_ROLE_CLAIM=BLOCKED`
- `DISABLED_ACCOUNT=BLOCKED`
- `LEGACY_USERS_COLLECTION=DENIED`
- `BROWSER_USER_MANAGEMENT=DENIED_DURING_MIGRATION`

The new negative Rule check confirms that a user with a non-canonical
`waterdashRole` cannot read reports. The Rules suite also confirms direct
`users/*` reads and writes, self-assigned `admin`/`superAdmin` aliases, and
unauthorized report, fuel, settings, and station operations are denied.

The browser runtime test uses a test-only injected emulator config. The small
runtime change preserves the production default Firebase configuration but
does not overwrite a pre-injected local configuration. A minimal fuel listener
lifecycle repair was also made: a listener that fails before login clears its
unsubscribe handle and restarts on Firebase Auth sign-in. Fuel arithmetic and
the cycle-scoped ledger were not changed.

## Test results

- `LEGACY_TESTS_DISCOVERED=73`
- `LEGACY_TESTS_EXECUTED=73`
- `LEGACY_TESTS_PASSED=73`
- `LEGACY_TESTS_FAILED=0`
- `RULES_TESTS_DISCOVERED=33`
- `RULES_TESTS_EXECUTED=33`
- `RULES_TESTS_PASSED=33`
- `RULES_TESTS_FAILED=0`
- `AUTH_ADMIN_TESTS_DISCOVERED=3`
- `AUTH_ADMIN_TESTS_EXECUTED=3`
- `AUTH_ADMIN_TESTS_PASSED=3`
- `AUTH_ADMIN_TESTS_FAILED=0`
- `BROWSER_TESTS_DISCOVERED=35`
- `BROWSER_TESTS_EXECUTED=35`
- `BROWSER_TESTS_PASSED=35`
- `BROWSER_TESTS_FAILED=0`
- `BUILD_ARTIFACT_TESTS_DISCOVERED=1`
- `BUILD_ARTIFACT_TESTS_EXECUTED=1`
- `BUILD_ARTIFACT_TESTS_PASSED=1`
- `TOTAL_TESTS_DISCOVERED=145`
- `TOTAL_TESTS_PASSED=145`
- `TOTAL_TESTS_FAILED=0`

Executed commands:

```text
npm run test:emulator
npm run test:emulator:browser
npm run build:verify
node test_full_audit.cjs
node test_premerge_integration.cjs
node test_fuel_accounting.cjs
node test_fuel_ledger.cjs
```

`npm run test:emulator` completed with `EMULATOR_AUTH_ADMIN_TESTS_PASSED=3`
and `RULES_TESTS_PASSED=33`. Expected `PERMISSION_DENIED` lines are the
asserted attack cases, not test failures. The Firebase CLI emitted an unrelated
dependency deprecation warning for `url.parse`; it did not affect application
or Rules behavior.

`npm run test:emulator:browser` completed with `BROWSER_TESTS_PASSED=35`.
It covers invalid login, super-admin session restore, all canonical roles,
disabled-account rejection, emulator-only requests, reports/detail/edit/
duplicate/add, fuel log/add form, dashboard filters/charts/alerts, responsive
390px and 360px layouts, settings, Excel and Word downloads, a generated PDF
print document, WhatsApp export URL, and logout. No unexpected browser console
or page errors occurred. The deliberately invalid local Auth-emulator login
may emit its expected local HTTP 400 resource message and is explicitly scoped
as an expected negative-path event.

## Runtime and export results

- `BROWSER_RUNTIME=PASS`
- `UI_390PX=PASS`
- `UI_360PX=PASS`
- `EXCEL=PASS`
- `WORD=PASS`
- `PDF=PASS` (generated print document verified in the browser test)
- `WHATSAPP=PASS`
- `PRODUCTION_FIREBASE_NETWORK_REQUESTS=0`

## Production-safety proof

- `PRODUCTION_FIRESTORE_READS=0`
- `PRODUCTION_FIRESTORE_WRITES=0`
- `PRODUCTION_FIRESTORE_DELETES=0`
- `PRODUCTION_AUTH_REQUESTS=0`
- `PRODUCTION_RULES_CHANGES=0`
- `DEPLOYMENTS=0`
- `MERGES=0`
- `PUSHES=0`

## Final decision

`FINAL_DECISION=GO`

This is a local production-candidate quality gate only. It authorizes no
deployment, merge, push, production Rules change, or production Firebase data
operation. Stop here and obtain explicit approval before any such action.
