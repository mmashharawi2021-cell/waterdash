# WaterDash Production Auth and RBAC Cutover Runbook

## Authorization gate

Every action in this runbook requires explicit human approval. It is a future operational procedure and does not authorize production access, changes, deployment, or queries from this branch.

## 1. Pre-cutover backup and approvals

1. Approve a change ticket naming the production Firebase project, release artifacts, rollback owner, account-migration owner, and incident contact.
2. Export and verify a protected Firestore backup using the approved production procedure. Record its location and restore test.
3. Capture versioned copies of deployed Rules, Hosting artifact, Auth provider configuration, and application configuration.
4. Confirm emulator Rules, attack, RBAC, build-integrity, and browser tests are current and approved. Stop if any required check is blocked or failing.

## 2. User inventory and identity mapping

1. Create a minimal, access-controlled inventory of legacy document ID, username, display name, claimed role, active state, and verified contact email. Do not include `passwordHash` in reports, spreadsheets, or tickets.
2. Human reviewers approve a one-to-one mapping to a Firebase Auth UID for every active account. Unresolved or duplicate mappings stop the cohort.
3. Record state as `LEGACY_NOT_MIGRATED`, `MIGRATED`, or `DISABLED`.
4. Translate roles only to `superAdmin`, `supervisor`, `dataEntry`, or `viewer`; resolve legacy `admin` manually. Never derive a role from browser input or a legacy Firestore write.

## 3. Trusted admin bootstrap

1. A named operator with a secret-manager-held service-account credential runs the reviewed Admin SDK/Cloud Function procedure for one pre-verified Firebase Auth UID.
2. The procedure sets `{ waterdashRole: 'superAdmin' }`, writes an immutable audit entry outside the browser, and receives second-person verification. It must not accept a deployed-frontend-supplied UID or role.
3. Test the first admin’s sign-in, token claim, and intended Rules operations. Stop before Rules/application deployment if any check fails.

## 4. Authentication enablement and migration

1. Explicitly enable the approved Firebase Auth provider.
2. Create/invite only mapped identities. Use a password-reset/invitation flow; never import, reverse, or reuse legacy SHA-256 hashes.
3. Set custom claims through the trusted mechanism in small approved cohorts.
4. Disable Auth accounts only for approved `DISABLED` mappings. Preserve legacy documents and hashes as read-protected migration data.
5. Revoke refresh tokens or require reauthentication after role/disable changes and verify refreshed claims.

## 5. Deployment order

1. Deploy the reviewed Firebase Auth client artifact and validate the pilot cohort while the old Rules release remains recoverable.
2. Deploy claim-based Firestore Rules only after every required active pilot user has verified identity and a role claim.
3. Confirm browser SDK access to legacy `users` documents is denied. No deployed UI may perform anonymous sign-in or browser hash comparison.
4. Expand cohorts only after validation checkpoints pass. Do not delete legacy data during this cutover.

## 6. Validation

- Sign-in, sign-out, and session restoration use Firebase Auth identity.
- Each canonical role can perform only its approved matrix operations.
- Direct SDK self-writes of `admin`/`superAdmin` roles are denied.
- Unprivileged report/fuel delete, settings/station update, and user-role writes are denied.
- Trusted role change takes effect after refresh/re-authentication.
- Console, network, exports, and fuel regression checks are clean.

## 7. Rollback triggers

Halt expansion for failed first-admin bootstrap, missing/duplicate mapping, inability for an active operator to sign in, incorrect role claim, unexpected Rules denial of approved work, browser access to legacy credentials, or any privilege escalation.

## 8. Rollback procedure

1. Freeze identity creation and role assignments; preserve audit logs.
2. Restore the last approved application and Rules release using the recorded ticket/artifacts. Do not delete identities or legacy data.
3. If necessary, use the trusted mechanism for a narrowly scoped temporary account/reset path; never re-open caller-writable roles or anonymous production authorization.
4. Revoke affected refresh tokens, investigate mappings/audit evidence, and rerun emulator attacks before a new authorization.

## Explicit human-authorized steps

Production backup/export, account inventory, identity verification, provider enablement, service-account/Admin SDK use, first-admin bootstrap, claim assignment, Rules deployment, application deployment, rollout expansion, and any rollback require explicit human authorization.
