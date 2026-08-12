# Slicing Plan: calendar-month-view-v1 Workspace Stabilization

## Why slicing is required

The current workspace combines calendar UX, customer-copy cleanup, animal online/offline contract changes, Quarkus native serialization fixes, and dev Docker updates. The accumulated diff is too large for one healthy review cycle and should be split into reviewable work units before PR.

Approximate current workspace size at review time:

- 68 modified files
- ~3,180 added lines
- ~1,151 removed lines

## Recommended slices

### Slice 1 — Quarkus native serialization hardening

Scope:

- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalCriteria.java`
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalResponse.java`
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/raza/*.java`
- `hato-be/src/main/java/bo/pasorapa/hato/service/filter/filters/*.java`
- `hato-be/src/main/java/bo/pasorapa/hato/service/page/*.java`

Validation evidence:

- Native Docker backend build passes.
- `/api/animals` returns a paged list.
- `/api/animals/count` returns expected count.
- `/api/razas/active` returns the 10 seeded active breeds.
- `/api/admin/razas` returns the seeded admin list.

Review notes:

- This slice fixes native-only runtime failures caused by missing reflection metadata.
- It should be reviewed separately because JVM tests alone do not cover this failure mode.

### Slice 2 — Calendar month view and veterinary visit creation

Scope:

- `hato-fe/src/app/features/admin/calendar/**`
- `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.*`
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` if needed by the calendar flow

Validation evidence:

- Calendar month/grid specs pass.
- Calendar page specs pass.
- Veterinary visit dialog date prefill specs pass.
- Manual smoke: selected calendar date pre-fills the visit modal.

Review notes:

- Keep the calendar UI and visit creation flow together because the visit modal integration is the main calendar action.

### Slice 3 — Customer-facing copy and operational UI cleanup

Scope:

- Route titles, sidebar/header copy, dashboard/backup/registration copy, and removed legacy calendar controls.
- Avoid mixing behavioral changes beyond copy/visual cleanup.

Validation evidence:

- Header/sidebar specs pass.
- Copy-focused specs pass.
- Manual smoke confirms no old calendar controls or English customer-facing copy remain.

Review notes:

- Preserve technical identifiers, routes, class names, and service names in English.

### Slice 4 — Animals online/offline contract

Scope:

- `hato-fe/src/app/features/admin/animals/data-access/animals.service.ts`
- `animals-events.service.ts`
- `animals-health-events.service.ts`
- `animals-reproduction-events.service.ts`
- `animals-images.service.ts`
- related animal component/spec changes

Validation evidence:

- Online create/update/event/image paths save directly to server without local outbox persistence.
- Offline create/update/event/image paths enqueue stable operation IDs and snapshots.
- Dead-letter outbox items do not force local reads while online.
- Focused animal specs pass.

Review notes:

- Sequential local snapshot writes are intentional to avoid local store races; do not replace them with `Promise.all` without proving store concurrency safety.

### Slice 5 — Dev Docker and local workflow adjustments

Scope:

- `infraestructure/dev/Dockerfile.fe`
- `infraestructure/dev/docker-compose.yml`
- `.gitignore` local-index cleanup

Validation evidence:

- `docker compose up -d --build` works for the dev stack.
- FE responds on `http://localhost:8080`.
- BE health responds on `http://localhost:8081/q/health`.

Review notes:

- Decide whether development Angular build in Docker is a temporary dev workaround or the desired dev-stack behavior.

## Stabilization items before PR

- Keep `.codegraph/` out of review scope.
- Add or keep a native-smoke command for endpoints that depend on reflection/Jackson serialization.
- Avoid expanding the feature set until slices are reviewed.
- If a single PR is unavoidable, explicitly request a size exception and include this slicing plan in the PR description.
