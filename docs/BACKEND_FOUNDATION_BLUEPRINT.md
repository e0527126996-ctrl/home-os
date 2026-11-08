# HOME OS — Backend Foundation Blueprint

**Status:** design-only blueprint; no runtime behavior changes.
**Target branch:** `feature/homeos-editorial-system-2026-11-07`
**Rule:** the existing IndexedDB application remains the working product until the replacement path is implemented, tested, and explicitly switched over.

## 1. Non-negotiable safety requirements

1. PostgreSQL is the eventual authoritative store for shared household data. A browser cache may improve responsiveness, but must never silently become a second source of truth.
2. The server derives the acting user from a verified session/token. Never accept `userId`, `role`, or permission claims supplied by the browser as authority.
3. Every household-owned read and write is scoped by a server-verified household membership. Missing scope or membership means deny.
4. Authorization is enforced in the service/API layer and, where practical, reinforced with PostgreSQL row-level security.
5. Database unavailability returns a clear 503 response. Do not fall back to IndexedDB for a write or report a write as successful.
6. No migration step may delete, overwrite, or mark local records as migrated until the server confirms a durable commit and the client verifies the returned record counts/checksum.
7. Secrets, PINs, access tokens, document contents, and bank data must never be written to application logs.

## 2. Recommended runtime layout

```
Browser (React)
  ├─ presentation and local draft state
  ├─ authenticated API client
  └─ explicit import/export and migration UI
          │ HTTPS
          ▼
Express API
  ├─ authentication middleware
  ├─ household context resolver
  ├─ permission policy / RBAC
  ├─ domain services (finance, food, documents, assets)
  ├─ validation and audit events
  └─ PostgreSQL repositories
          │
          ▼
PostgreSQL
  ├─ users / households / memberships
  ├─ permissions / audit log
  ├─ financial accounts / ledger
  ├─ household documents metadata
  └─ food / assets / planning
```

Keep route handlers thin: parse and validate input, obtain trusted request context, call a domain service, and map typed errors to HTTP responses. Do not put SQL or authorization decisions in React components.

## 3. Suggested server-side module boundaries

- `server/index.ts`: Express bootstrap, shutdown hooks, health endpoints.
- `server/config/env.ts`: validated environment configuration; fail startup for missing required secrets.
- `server/middleware/auth.ts`: verify Firebase ID token (or the selected identity provider) and create a trusted principal.
- `server/middleware/household-context.ts`: resolve requested household only after checking active membership.
- `server/policies/`: permission checks for domain + action; deny by default.
- `server/routes/v1/`: versioned HTTP routes.
- `server/services/`: business rules and transactions.
- `server/repositories/`: Drizzle queries and persistence.
- `server/db/`: PostgreSQL pool, Drizzle instance, migrations.
- `server/errors/`: stable error codes and safe HTTP mapping.

The first server milestone should expose health/readiness only. Do not wire the browser to partially implemented domain endpoints.

## 4. API contract baseline

All routes live under `/api/v1`. JSON responses use a consistent envelope:

```json
{ "data": {}, "meta": { "requestId": "..." } }
```

Errors use:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "..."
  }
}
```

Initial route set, to be implemented incrementally:

| Method | Route | Purpose | Required policy |
|---|---|---|---|
| GET | `/health/live` | Process is alive | none |
| GET | `/health/ready` | DB and required dependencies are ready | none |
| GET | `/me` | Verified identity and memberships | authenticated |
| GET | `/households/:householdId` | Household profile/settings | household read |
| GET/POST | `/households/:householdId/accounts` | List/create accounts | finance read/write |
| GET/POST | `/households/:householdId/transactions` | List/create ledger entries | finance read/write |
| POST | `/households/:householdId/documents` | Upload document metadata/blob | documents write |

Do not expose bulk arbitrary table CRUD. Validate every request with a schema, bound pagination, cap upload size, and use idempotency keys for retryable financial writes.

## 5. Data model and tenant isolation

Every tenant-owned table must contain a non-null `household_id`, with indexes beginning with that key for common access paths. Use foreign keys and unique constraints to encode invariants, not only application checks.

Core entities:

- `users`: identity-provider subject, normalized email, display profile. Never store plaintext PINs or passwords.
- `households`: household profile and settings.
- `household_memberships`: unique (`household_id`, `user_id`), role, status, joined timestamp.
- `household_persons`: family members/dependents; linked user is optional.
- `household_permission_rules`: membership + domain, explicit capabilities.
- `audit_logs`: actor, household, action, entity type/id, timestamp, request ID; avoid sensitive payload snapshots.
- Finance, documents, food, assets, and planning entities: all household-scoped.

Use database transactions for multi-row operations (especially transfers). A transfer must create both ledger legs atomically, validate that both accounts belong to the same household, and enforce a unique transfer identifier.

## 6. Authentication and authorization rules

- Verify identity-provider tokens on every protected request; reject expired, malformed, or wrong-audience tokens.
- The client may send a household selector, but the server must independently confirm membership and status.
- Resolve permissions from server-side membership and policy records; never trust client-side `accessControl.ts` results.
- Deny by default when a permission record is absent or malformed.
- Separate authentication (who is the user?) from authorization (what can they do in this household?).
- Add rate limits to authentication-sensitive and document-upload endpoints.
- Remove local PIN authentication only after a tested replacement login flow and migration/recovery path exist.

## 7. Local data migration protocol

Migration must be explicit, resumable, and non-destructive.

1. **Preflight:** detect IndexedDB schema version; enumerate record counts by store; check required fields and duplicate IDs; calculate a deterministic export checksum.
2. **Backup:** produce a downloadable encrypted backup where feasible; never transmit it automatically.
3. **Preview:** show the user counts, invalid rows, conflicts, and target household before upload.
4. **Stage:** upload bounded batches with a migration ID; server stores them in staging tables or an isolated migration namespace.
5. **Validate:** verify relationships, ownership, amounts in integer cents, dates, document metadata, and duplicate constraints.
6. **Commit:** a server-side transaction promotes the staged data; return a migration receipt with counts and checksum.
7. **Verify:** client re-reads server data and compares counts/checksum; retain the local copy unchanged during the observation period.
8. **Cut over:** only after explicit release approval, switch reads/writes to the API. Keep export/rollback available.
9. **Retire local writes:** a later release may make IndexedDB a read-only cache; removal is a separate migration with a documented recovery plan.

Never use a single giant request for all household data. Documents should be uploaded separately using signed/authorized upload flows and verified content metadata.

## 8. Reliability, observability, and response behavior

- `/health/live` checks process liveness only; `/health/ready` checks DB connectivity and migration compatibility.
- Return 503 for unavailable database/dependencies; return 401 for unauthenticated, 403 for unauthorized, 409 for conflicts, 422 for invalid domain data.
- Use request IDs and structured logs, with redaction by default.
- Configure graceful shutdown to stop accepting requests and close the DB pool.
- Add bounded retries only for safe/idempotent operations. Never blindly retry a financial POST without an idempotency key.
- Apply connection limits, statement timeouts, and transaction timeouts.

## 9. Release gates

A milestone is not complete until all applicable gates pass:

- TypeScript build and lint.
- Unit tests for policies, validators, and domain services.
- Integration tests against a real disposable PostgreSQL instance.
- Cross-household isolation tests proving household A cannot read or mutate household B.
- Tests for missing/expired tokens and missing permission records.
- Transfer atomicity and duplicate/idempotency tests.
- DB-down tests proving readiness fails and protected writes return 503 without local fallback.
- Migration tests for interrupted batches, retries, duplicate IDs, checksum mismatch, and rollback.
- Secret scanning and dependency audit.
- Manual browser regression against a copy of representative local data.

## 10. Recommended implementation sequence

1. Add server bootstrap, validated environment config, PostgreSQL connection, Drizzle config, and liveness/readiness endpoints. Keep it unused by the frontend.
2. Add schema migrations and database integration test harness.
3. Add verified authentication and trusted household context.
4. Implement deny-by-default policies and cross-tenant tests.
5. Implement read-only `/me` and household endpoints.
6. Implement one narrow finance vertical (accounts, then transactions/transfers) with integer-cent invariants.
7. Implement migration staging/validation/receipt workflow.
8. Add documents storage with size/type limits and private access.
9. Migrate remaining domains incrementally.
10. Switch the frontend only after parity, backup, rollback, and release gates are demonstrated.

**Current repository reality:** this blueprint does not assert that PostgreSQL, Drizzle, Firebase authentication, or an API is already active. The existing IndexedDB application remains unchanged by this document.
