# WaterDash Auth and RBAC Migration Report

## Release state

```text
BASE_SHA=44bc81b6e3a67030f190a6a148d9cd82b645007c
WORKING_BRANCH=fix/production-blockers-20260823
FINAL_SHA=f48ced5bb04bb1d0d218aba870f6831d7a90f009

AUTH_CURRENT_MODEL=Anonymous Auth plus browser credential/hash checks and caller-writable Firestore roles
AUTH_TARGET_MODEL=Firebase Auth native identity plus Firebase Admin-issued waterdashRole custom claim
CANONICAL_ROLES=superAdmin,supervisor,dataEntry,viewer

P0_PRIVILEGE_ESCALATION=BLOCKED
ROLE_MISMATCH=FIXED
BROWSER_PASSWORD_AUTH=REMOVED
ANONYMOUS_AUTH_SECURITY_BOUNDARY=NO

EMULATOR_AUTH=BLOCKED
EMULATOR_FIRESTORE=BLOCKED
SELF_ADMIN_ATTACK=BLOCKED
SELF_SUPERADMIN_ATTACK=BLOCKED
RBAC_TESTS_PASSED=0
RBAC_TESTS_FAILED=0
RBAC_TESTS_BLOCKED=32

BUILD=PASS
BUILD_ARTIFACT_INTEGRITY=PASS

LEGACY_TESTS=73/73 PASS
TOTAL_TESTS_PASSED=74
TOTAL_TESTS_FAILED=0
TOTAL_NEW_TESTS_DEFINED=36
TOTAL_NEW_TESTS_EXECUTED=1

FUEL_1056_228_828=PASS
HISTORICAL_21_08=PASS

BROWSER_SMOKE=BLOCKED
CONSOLE=BLOCKED
NETWORK=BLOCKED
EXPORT_TESTS=LEGACY WhatsApp regression checks PASS; isolated emulator export test BLOCKED

PRODUCTION_FIRESTORE_READS=0
PRODUCTION_FIRESTORE_WRITES=0
PRODUCTION_FIRESTORE_DELETES=0
PRODUCTION_AUTH_USERS_CREATED=0
PRODUCTION_RULES_DEPLOYED=NO
PRODUCTION_DEPLOYMENT=NO

CUTOVER_RUNBOOK_CREATED=YES
FINAL_DECISION=NO-GO
```

## Candidate implementation

The active candidate runtime no longer loads the legacy `auth-system.js` file.
It signs in through Firebase Email/Password and derives the display/UX role from
the signed Firebase ID-token claim `waterdashRole`. It does not restore role or
permission data from localStorage, does not perform a browser SHA-256 password
comparison, and does not call anonymous sign-in.

Firestore Rules now derive every operational permission from the canonical
claim and deny all browser reads/writes to legacy `users` documents. This means
direct writes of `{ role: 'admin' }` and `{ role: 'superAdmin' }` cannot become
an authorization source. Role assignment and account disablement are reserved
for Firebase Admin SDK/trusted server code. The browser’s user-management
navigation presents that migration boundary rather than exposing a client role
editor.

The legacy `users` records, password hashes, and old source file remain
preserved and unreferenced as migration-only compatibility evidence. They were
not read, changed, deleted, or migrated.

## Validation performed

- `npm ci` completed with the added local emulator dependencies.
- `npm run build:verify` passed. Vite still reports its classic-script warning;
  it is not hidden. The Vite copy plugin explicitly writes every required
  classic CSS/JS asset to `dist`, and `test_build_artifact.cjs` verified every
  local asset referenced from `dist/index.html` plus the generated manifest.
- Existing regression commands passed: `test_full_audit.cjs` 31/31,
  `test_premerge_integration.cjs` 29/29, `test_fuel_accounting.cjs` 5/5, and
  `test_fuel_ledger.cjs` 8/8.
- New emulator tests were created for Admin-issued claims/disabled users (3
  checks), self-admin and self-superAdmin writes, all canonical-role actions,
  direct SDK bypasses, and immutable audit/preference behavior (32 Rules
  checks). They contain loopback-only guards.

## Validation blocker

`npm run test:emulator` used the dedicated `firebase.emulator.json`, project
`waterdash-emulator`, `127.0.0.1` ports, and Android Studio JBR. Firebase CLI
received HTTP 200 while downloading `cloud-firestore-emulator-v1.22.0.jar`, but
the temporary file remained zero bytes and the process never started Firestore.
The local process was stopped. No fallback to production was attempted.

Because the emulator never started, the new Auth, Firestore Rules, privilege
escalation, RBAC, role-management/session, browser smoke, console/network, and
isolated export checks are blocked. The security patch is source-reviewed and
build-verified, but P0 is deliberately not declared closed until the emulator
attack suite passes.

## Exact cutover prerequisites

1. Successfully download/start the local Auth and Firestore emulators and pass
   every new attack/RBAC/Auth test and local browser smoke test.
2. Explicit human approval of the production change, backup, rollback owner,
   and cutover runbook.
3. Approved inventory and one-to-one verified Firebase Auth UID mapping for
   each active legacy user; unresolved `admin` mappings must be decided by a
   human.
4. Approved password-reset/invitation process; no SHA-256 hash migration.
5. Secret-managed, audited trusted Admin SDK/Cloud Function mechanism and a
   verified first superAdmin bootstrap.
6. Pilot validation, claim refresh/revocation test, and approval before any
   application or Rules deployment.
