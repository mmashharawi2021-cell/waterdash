# WATERDASH Production Pre-Cutover Report — Fuel Cycle Administration

## Decision and safety boundary

- `FUEL_CYCLE_ADMIN_UI=PASS`
- `FUEL_RESET_BUTTON=PASS`
- `FUEL_RESTORE_FROM_DATE=PASS`
- `FUEL_CYCLE_AUTHORIZATION=PASS`
- `FUEL_CYCLE_RULES=PASS`
- `FUEL_CYCLE_PREVIEW=PASS`
- `FUEL_CYCLE_AUDIT_LOG=PASS`
- `FUEL_CYCLE_CONCURRENCY=PASS`
- `CURRENT_VERIFIED_CYCLE_START=2026-08-22`
- `PRODUCTION_CYCLE_MODIFIED=NO`

All implementation and verification in this step used only the local Firebase
Auth and Firestore emulators. No production Firestore read, write, delete,
Rules update, authentication request, deployment, merge, or push occurred.

## Implementation

The active boundary is the protected Firestore configuration document:

```text
settings/fuelCycle
  startDate: YYYY-MM-DD
  updatedAt: server timestamp
  updatedBy: Firebase Auth UID
  revision: integer
```

`assets/fuel-system.js` retains `2026-08-22` only as the legacy-compatible
default until the protected document exists. Once present, `settings/fuelCycle`
is the sole active-cycle source used by the canonical ledger. No future reset
date is hard-coded.

Changes are performed by a Firestore transaction that compares the expected
revision, writes the new boundary, and appends the audit event atomically:

```text
activityLogs/{generated-id}
  actionType: FUEL_CYCLE_RESET | FUEL_CYCLE_RESTORE
  previousCycleStart
  newCycleStart
  changedBy: Firebase Auth UID
  changedAt: server timestamp
  cycleRevision
```

The Rules permit creation/update of `settings/fuelCycle` only to `superAdmin`,
require the caller UID, server timestamp, revision increment, and valid
calendar-shaped date. The cycle-audit event is also restricted to super-admin
and validated against the transaction's `getAfter()` cycle state. Supervisor,
data-entry, viewer, and unauthenticated direct SDK writes are denied.

The Fuel page renders the RTL controls **تصفير الوقود** and **استعادة الاحتساب
من تاريخ** only for super-admin. Both use an application modal, never browser
`confirm()`. The reset modal shows current/proposed boundary and canonical
incoming, consumption, balance, and included-record counts. Restore provides a
read-only preview from the exact same `getCycleLedger` function before a second
explicit confirmation.

Changing the boundary never modifies or deletes reports or fuel entries.
Rollback is a normal restore to the preceding boundary; the ledger then
recalculates from unchanged historical data.

## Files and functions

- `assets/fuel-system.js`: `getCycleLedger`, `getCurrentCycleLedger`,
  `getCycleState`, `openCycleReset`, `openCycleRestore`, `previewCycleDate`,
  `confirmCycleChange`, `cancelCycleChange`, and Palestine-local date handling.
- `assets/ui-system.js`: Fuel management controls/modal, and dashboard fuel KPI
  plus fuel alert values sourced from the canonical current-cycle ledger.
- `firestore.rules`: protected `settings/fuelCycle` and validated cycle audit
  events in the existing `activityLogs` collection.
- `test_fuel_cycle_admin.cjs`: pure ledger/date/history regression tests.
- `test_emulator_rules.cjs`: direct SDK authorization and atomic Rules tests.
- `test_emulator_browser.cjs`: local super-admin workflow, preview, cancel,
  reset/restore, audit, concurrency, responsive, and role-visibility tests.
- `package.json`: `npm run test:fuel-cycle-admin`.

## Verification

- `LEGACY_REGRESSION=73/73 PASS`
- `RULES_EMULATOR=40/40 PASS`
- `AUTH_ADMIN_EMULATOR=3/3 PASS`
- `FUEL_CYCLE_UNIT=13/13 PASS`
- `BROWSER_EMULATOR=57/57 PASS`
- `BUILD_ARTIFACT=PASS`
- `TOTAL=187/187 PASS`

The local browser workflow verified: super-admin reset and restore, cancel does
not write, selected-date preview equals the saved ledger, `1056 - 228 = 828`,
pre-boundary entries/reports are excluded but unchanged, the historical
2026-08-21 report never returns `-3059.77`, dashboard KPI/alert values follow
the canonical ledger, concurrent revision changes are refused rather than
silently overwritten, audit records are appended, and 390px/360px layouts,
exports, and existing Auth/RBAC paths remain functional.

Expected `PERMISSION_DENIED` messages in the Rules suite are the asserted
attack cases. Firebase CLI's `url.parse` deprecation warning is from a CLI
dependency and did not affect the application, Rules, or test result.
