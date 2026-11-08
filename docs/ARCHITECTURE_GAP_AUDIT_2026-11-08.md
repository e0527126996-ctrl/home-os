# HOME OS Architecture Gap Audit
**Audit date:** 2026-11-08  
**Scope:** Active feature branch `feature/homeos-editorial-system-2026-11-07`  
**Purpose:** Record the implementation state before further backend/security work. This is an audit note, not a migration or authorization to change production data.

## Executive finding

The current branch is still a browser-local application. Its primary data store is IndexedDB, not PostgreSQL. The repository snapshot reviewed for this audit does not contain a server entry point, Drizzle schema/configuration, or a database API client. This differs materially from the previously discussed target architecture: Express + Drizzle + PostgreSQL as the sole source of truth, with server-enforced authentication and household authorization.

The UI and domain logic can continue to be improved, but the application should not be described as a multi-user cloud system or as PostgreSQL-backed until that architecture is implemented and tested.

## Evidence in the current branch

| Area | Current implementation observed | Consequence |
|---|---|---|
| Persistence | `src/lib/db.ts` declares `HomeOSIndexedDB`, opens `home_os_db`, and stores household, member, account, ledger, document and home data in browser IndexedDB. | Data is local to the browser profile/device unless separately exported or synchronized by another mechanism. |
| API/backend | `package.json` exposes Vite dev/build scripts; no server start script is present. The inspected data layer contains no HTTP API calls. | No verified server-side persistence boundary was found in this branch. |
| PostgreSQL/Drizzle | No `drizzle.config.ts`, Drizzle schema, PostgreSQL package, or server DB module was found at the expected repository paths. | PostgreSQL is not yet the active source of truth in this branch. |
| Authentication | `src/components/AuthModal.tsx` performs local profile switching and compares a PIN in the browser. `src/types.ts` stores an optional `pin` field on the user record. | This is a local profile gate, not server-verified identity authentication. |
| Seed user | `src/lib/db.ts` creates a default owner profile with a hard-coded PIN during initial seeding. | Must be replaced with a first-run setup flow before any shared/cloud deployment. |
| Authorization | `src/lib/accessControl.ts` and UI checks provide client-side domain permission logic. | Client-side checks improve UX but cannot be the security boundary for a remote multi-tenant database. |

## Risks to resolve before cloud / multi-user deployment

1. **Data durability and portability:** IndexedDB is not a shared household database and can be cleared with browser data. Define a verified export/import and migration path before changing persistence.
2. **Identity:** Replace local PIN comparison with server-verified authentication (Firebase Auth or another approved identity provider). Never trust a user ID supplied by the browser.
3. **Tenant isolation:** Enforce household membership and domain permissions in server-side queries and mutations. Every data access must be scoped to the authenticated user's authorized household.
4. **Credential handling:** Remove hard-coded seeded credentials and plaintext PIN storage. Use a first-run owner setup and never store reusable secrets in browser records.
5. **Document storage:** Define private object storage and authorization for document blobs; do not assume browser-local blob storage is a cloud document service.
6. **Operational behavior:** Database unavailability must fail closed with an explicit service error (for example HTTP 503); do not silently fall back to browser-local writes.
7. **Migration safety:** Do not silently dual-write IndexedDB and PostgreSQL. Create an explicit, idempotent, user-confirmed migration with counts, validation, backup, and rollback.

## Recommended implementation sequence

### Phase A — Backend foundation
- Add a separately runnable Express server and health endpoint.
- Add Drizzle schema and migrations for users, households, memberships, permissions, accounts, ledger transactions, documents metadata, and home-management records.
- Configure PostgreSQL as the only authoritative write/read store for cloud mode.
- Add server-side authentication middleware and tenant-scoped repository functions.
- Return explicit 503 responses when PostgreSQL is unavailable.

### Phase B — Security and contract tests
- Add tests for unauthenticated access, cross-household reads/writes, read-only roles, domain permissions, approval permissions, and database outage behavior.
- Ensure no client-provided household ID can bypass membership checks.
- Add audit logging for sensitive mutations.

### Phase C — Frontend migration
- Introduce typed API clients and loading/error states.
- Migrate one domain at a time, beginning with accounts and ledger.
- Keep the current IndexedDB data intact until a migration tool has been tested on a copy.
- Add a clear export/backup and migration confirmation workflow.

### Phase D — Retirement of local-only auth and storage
- Remove the local PIN gate and hard-coded seed account after the server-auth flow is proven.
- Remove cloud-mode reads/writes to IndexedDB only after migration and recovery tests pass.
- Keep an explicitly named offline mode only if it has a documented sync/conflict model.

## Guardrails

- Do not merge this audit or any migration to `main` without explicit approval.
- Do not delete or overwrite existing IndexedDB data as part of backend work.
- Do not claim PostgreSQL, Firebase Auth, server-side RBAC, or cloud document storage is active until implementation and tests prove it.
- Keep the current local app usable while the backend is built in isolated, reviewable increments.
