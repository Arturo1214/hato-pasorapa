# offline-conflict-resolution-v2 Specification

## Purpose
Definir contrato transversal para diff visual, resolución manual y reintento post-resolución en conflictos offline de `/api/sync`.

## Requirements

### Requirement: Visual conflict diff and manual workflow
The system MUST expose, per conflicted `operationId`, a visual diff (`local payload` vs `server state`) with field severity, and MUST allow only `accept_server`, `retry_local`, or `discard_local` by entity/opType policy; in mixed batches, resolution and post-resolution retry MUST preserve idempotency and ordering for unaffected operations.
(Previously: all users could access resolution; now GANADERO sees status only)

#### Scenario: Diff visible y opciones válidas
- GIVEN una operación en estado `CONFLICT`
- WHEN el usuario abre detalle de conflicto
- THEN el sistema muestra diff por campo con severidad

#### Scenario: Reintento posterior a resolución
- GIVEN un conflicto resuelto con `retry_local`
- WHEN se ejecuta el siguiente ciclo de sync
- THEN la operación se reprocesa respetando idempotencia por `operationId`

#### Scenario: Conflicto encadenado en lote mixto
- GIVEN un lote mixto con una operación en conflicto y otras válidas
- WHEN se resuelve el conflicto y corre el retry posterior
- THEN operaciones no conflictuadas no se duplican ni reordenan

### Requirement: Conflict status visible to GANADERO without resolution access

The system MUST display conflict status badges to GANADERO users on records, rows, and media cards, but MUST NOT expose conflict resolution controls in their navigation or workflow.

#### Scenario: Conflict badge visible to GANADERO
- GIVEN a record in `CONFLICT` state
- WHEN a GANADERO user views the record
- THEN a conflict badge is displayed inline
- AND no resolution UI (accept_server, retry_local, discard_local) is presented

#### Scenario: Conflict badge on photo card
- GIVEN an image operation in `CONFLICT` state
- WHEN the GANADERO views the photo gallery
- THEN the thumbnail displays a conflict badge
- AND no resolution controls are accessible

### Requirement: Conflict resolution retained for admin/support path

The system MUST keep conflict resolution tools (diff view, manual resolution actions) accessible to admin and support users through the existing support channel.

#### Scenario: Admin can access conflict resolution
- GIVEN an admin user viewing a conflicted record
- THEN resolution controls (accept_server, retry_local, discard_local) remain available
- AND the diff view is accessible
