# WaterDash Auth and RBAC Migration Plan

## Current and target models

| Aspect | Current model | Target model |
| --- | --- | --- |
| Identity | Anonymous Firebase Auth plus browser-configured credential check | Firebase Authentication Email/Password, or an explicitly approved Firebase-native provider |
| Password verification | Browser SHA-256 comparison against Firestore data | Firebase Authentication only; no password hash reaches browser code |
| Authorization | Caller-writable `users/{uid}.role` plus UI guards | Signed ID-token custom claim `waterdashRole`, set only by trusted Admin SDK/server |
| Role management | Browser UI writes roles and permissions | Trusted Admin SDK/Cloud Function/admin console outside browser |
| Enforcement | Client checks and unsafe Rules lookup | Firestore Rules derived solely from immutable-to-client token claims |

## Architecture decision

| Criterion | A. Auth custom claims | B. Server-controlled Firestore role document |
| --- | --- | --- |
| Self-elevation resistance | Strong: only Admin SDK can mint claims | Strong only when Rules deny all client writes and server is sole writer |
| Rules complexity | Small, token-only checks | Protected role-document lookup per authorization decision |
| Role refresh | Token refresh/sign-out required | Rules observe write immediately, client display still refreshes |
| Operational management | Trusted Admin SDK/server required | Trusted server and a new protected collection required |
| Migration risk | No new role collection | Adds a role data model and lifecycle |
| WaterDash fit | Smallest complete boundary change | Secure, but larger than required |

Selected architecture: **Firebase Authentication plus `waterdashRole` custom claims**. It is the smallest secure model because Rules do not read a caller-writable document. A trusted administrative tool remains a future cutover prerequisite and must keep credentials outside the browser.

## User mapping and password migration

1. Preserve every legacy `users` document and `passwordHash` unchanged during this task.
2. Before cutover, an authorized administrator creates a minimal, access-controlled inventory of legacy document IDs, usernames, display names, claimed role, active state, and verified email. Do not export or display password hashes.
3. Require a human-approved one-to-one mapping from legacy document ID to verified Firebase Auth UID. Source review does not prove this map exists today.
4. For verified emails, create Firebase Auth identities via an administrator-controlled invite/reset flow. For missing emails, collect and verify one or use an explicitly approved Firebase-native provider. Never invent emails.
5. Do not reuse, reverse, or bridge legacy SHA-256 hashes. Supported migration is controlled password reset or administrator-created Firebase Auth account.
6. Map roles only after review to `superAdmin`, `supervisor`, `dataEntry`, or `viewer`. Map legacy `admin` solely through an explicit human decision.

## Migration states and sessions

Maintain an operational migration ledger outside the browser with states `LEGACY_NOT_MIGRATED`, `MIGRATED`, and `DISABLED`, recording legacy ID, verified Auth UID, canonical role, active state, approval, and time. It is migration evidence, never a browser authorization source.

After changing a claim, force token refresh or revoke refresh tokens and require sign-in again. Client role display comes from the Firebase token, not localStorage. Disabled Firebase Auth users cannot sign in; a `DISABLED` ledger state must be mirrored by trusted Auth-account disablement.

## First super-admin bootstrap

Only during an explicitly authorized cutover window, a named operator runs an audited Admin SDK command or Cloud Function using a secret-managed service account. It targets a pre-verified Auth UID, sets `{ waterdashRole: 'superAdmin' }`, and records operator, UID, time, and approval ticket. Frontend code, Firestore writes, emulator fixtures, and anonymous identities cannot bootstrap this claim.

## Cutover order

1. Obtain explicit human authorization, verified backups, inventory, mapping approvals, and rollback ownership.
2. Enable the approved Auth provider; create/invite mapped identities without changing legacy documents.
3. Bootstrap the first superAdmin through the trusted mechanism; pilot reviewed claim assignments.
4. Deploy the Firebase Auth client candidate and validate pilots.
5. Deploy claim-based Rules only after required active users have working identities and rollback is ready; remove browser access to legacy password/user data at the same boundary.
6. Validate login, token refresh, roles, and authorized operations.
7. Keep legacy records read-protected for the approved retention period. Deletion is a separate authorization.

## Rollback and recovery

Rollback means an approved application-and-Rules release rollback, not data deletion. Preserve versioned artifacts. Trigger rollback for failed bootstrap, an unmapped required user, materially wrong role mapping, provider outage, or critical authorized-work Rules denials. Stop new batches, preserve audit evidence, restore the approved release, and investigate from the mapping ledger. Do not resurrect the insecure model without explicit incident authority; use a trusted temporary account/reset procedure.

## This task’s boundary

This branch implements and tests the target against Firebase Emulator only. It does not create production Auth users, query/modify production Firestore, deploy Rules/configuration, remove legacy data, merge, or push.
