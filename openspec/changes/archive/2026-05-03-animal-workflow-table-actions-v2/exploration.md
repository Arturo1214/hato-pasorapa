# Exploration: `animal-workflow-table-actions-v2`

## 1. Current State

### FE — Animals Page (`animals-page.component.ts`)

Currently a **card-grid layout** (no table). Each animal card shows:
- Identifiers (arete/marca/tatuaje), owner, category, admission date
- Inline buttons: "Registrar evento", "Registrar evento reproductivo", "Agregar imágenes", "Editar ficha"
- Three expandable histories: operativo, sanitario, reproductivo
- Image grid per animal

**Filters** (top card): visible (text), ownerGanaderoId (text), category (select), active (select).

**Problem**: ALL event registration is a **global form above the animal list** — not per-row actions. The user must select the animal via a text input, then fill the form. This violates the new product rule: "actions over the animal in the column actions".

**Category options** (hardcoded):
```
COW → Vaca | BULL → Toro | CALF → Ternero/a | HEIFER → Vaquillona
```
Missing: `TERNERO`, `TERNERA`, `BUEY` as separate categories.

**New animal button** does NOT exist — creation is the last card-form at the bottom.

---

### BE — Animal Domain

**`AnimalCategory` enum** (BE):
```java
COW, BULL, CALF, HEIFER
```
Only 4 values — missing the 6 desired categories.

**`AnimalSex` enum** (BE):
```java
MACHO, HEMBRA
```
Already exists, but **NOT validated against category** in `AnimalService`.

**`AnimalRequest` DTO** — has both `category` AND `sex` as `@NotNull`:
```java
@NotNull AnimalCategory category
@NotNull AnimalSex sex
```
Sex is mandatory on create/update.

**`AnimalMapper`** — maps both fields to entity.

**`AnimalService.applyCoreState()`** — validates at least one visible identifier; no category×sex consistency check.

**Event types** (operative):
```java
SOLD, DECEASED, LOST, TRANSFERRED, OBSERVATION
```
Missing: `CASTRATION` event type.

**Reproduction event types**:
```java
SERVICE, PREGNANCY_CONFIRMED, PREGNANCY_LOSS, BIRTH
```
Reproduction events already have `motherAnimalUuid`, `fatherAnimalUuid`, `offspringAnimalUuids` in metadata JSON.

---

### UI Reference Pattern

**`admin-users-page.component.ts`** + **`DataTableComponent`** + **`user-form-dialog.component.ts`** form the reference pattern:
- Toolbar button ("Crear usuario") opens `UserFormDialogComponent` via `MatDialog`
- `DataTableComponent` renders table with per-column filters, per-row actions
- Row actions fire `rowAction` event → handler dispatches dialogs
- View/Edit/Toggle actions on each row

This is exactly the pattern the animal page needs to adopt.

---

## 2. Affected Areas

| Area | File | What's there | What changes |
|------|------|---------------|--------------|
| **FE** | `animals-page.component.ts` | Card-grid, inline forms, global event registration | Replace with DataTable + modal dialogs |
| **FE** | `animals.service.ts` | `AnimalCategory = 'COW' \| 'BULL' \| 'CALF' \| 'HEIFER'` | Expand to 6 categories |
| **FE** | `animals-images-offline-flow.spec.ts` | Image offline logic | No change |
| **FE** | `shared/ui/data-table/` | Already exists | No change |
| **BE** | `AnimalCategory.java` | `COW, BULL, CALF, HEIFER` | Add `TERNERO, TERNERA, BUEY` |
| **BE** | `AnimalSex.java` | `MACHO, HEMBRA` | No change (already exists) |
| **BE** | `AnimalRequest.java` | Both fields mandatory | No change needed |
| **BE** | `AnimalMapper.java` | Maps category + sex | May need update |
| **BE** | `AnimalService.java` | No category×sex validation | Add category×sex consistency rules |
| **BE** | `AnimalEventType.java` | Missing `CASTRATION` | Add `CASTRATION` |
| **BE** | DB migrations | Existing schema | Add category×sex constraints or let it be application-level |
| **Offline FE** | `offline-types.animal-image.spec.ts` | AnimalImage types | May need refresh |

---

## 3. Category×Sex Consistency

**Required transitions:**
- `TERNERO` (MACHO) → `TORO` (MACHO) — OR → `BUEY` (MACHO) via castration
- `TERNERA` (HEMBRA) → `VAQUILLONA` (HEMBRA) → `VACA` (HEMBRA)
- `TERNERO/TORO` (MACHO) → `BUEY` (MACHO) via `CASTRATION` event

**Questions that need clarification (product rules):**
1. What are the **age thresholds** for TERNERO→TORO and TERNERA→VAQUILLONA transitions? Is it age-based, weight-based, or event-driven?
2. Does the system **auto-transition** categories based on events (e.g., BIRTH event on a VAQUILLONA → auto-upgrade to VACA)? Or is manual update required?
3. Is **castration** a new `AnimalEventType` (`CASTRATION`) that triggers automatic category change to `BUEY`?
4. Should the system **prevent invalid category×sex combinations** at create time (e.g., `VACA` with `sex=MACHO`)?

---

## 4. Gaps Identified

| Gap | Severity | Notes |
|-----|----------|-------|
| `DataTable` UI pattern not applied to animals | HIGH | Card grid must become table+toolbar |
| `UserFormDialogComponent`-style modal for new animal | HIGH | "Nuevo animal" opens modal, not bottom card |
| Per-row action buttons on animals | HIGH | Registro operativo/reproductivo as row actions |
| 2 missing category values (`TERNERO`, `TERNERA`, `BUEY`) | HIGH | 6 desired vs 4 existing |
| `CASTRATION` event type missing | MEDIUM | Needed for BUEY transition |
| Category×sex consistency rules not implemented | HIGH | Business logic gap |
| Age/weight thresholds for auto-transitions | MEDIUM | Clarification needed from product |
| `sex` field not surfaced in FE animals-page | MEDIUM | FE `AnimalItem` doesn't include `sex` |
| Global event forms (not per-row) | HIGH | Violates product rule |

---

## 5. Approaches

### Approach A — "Full Table + Modal Refactor" (Recommended)
Convert the entire animals page to the `DataTable` + modal pattern matching `admin-users-page`. Implement all 6 categories, add `CASTRATION` event, and category×sex rules.

**Scope:**
- FE: `animals-page` → table UI, row action modals
- FE: `animals.service.ts` → add `sex` to `AnimalItem`, expand `AnimalCategory`
- BE: Add `TERNERO`, `TERNERA`, `BUEY` to enum
- BE: Add `CASTRATION` to `AnimalEventType`
- BE: `AnimalService` → category×sex validation on create/update
- BE: Add reproduction event guard (only VACA/VAQUILLONA for reproduction events)

**Pros:** Complete alignment with product rules, clean UI pattern, extensible  
**Cons:** Large change, significant BE logic, requires product rule clarification on transitions  
**Effort:** High

### Approach B — "Incremental Table Migration"
Keep the current card grid but refactor event registration to row actions first (without modal), then convert to table in a follow-up SDD.

**Scope:**
- FE: Row action buttons on existing cards, inline or side panel for event forms
- BE: Same category/event changes as Approach A

**Pros:** Smaller immediate scope, easier to review  
**Cons:** Doesn't fully match the reference pattern (admin-users uses table+modal), partial delivery  
**Effort:** Medium

### Approach C — "Scoped V2 Only"
Limit V2 to: table UI, new animal modal, row action buttons, category expansion. Leave castration and auto-transitions for V3.

**Pros:** Focused scope, deliverable  
**Cons:** Incomplete — castration/BUEY category is explicitly requested  
**Effort:** Medium

---

## 6. Recommendation

**Proceed with Approach A** but **carve out auto-transition rules** (TERNERO→TORO age threshold, BIRTH→VACA auto-upgrade) as an **open product question** to clarify before `sdd-spec`.

The UI pattern (table + modal) + category expansion + CASTRATION event + row-based actions are well-defined enough to proceed. Auto-transition business rules need explicit product confirmation.

---

## 7. Risks

| Risk | Impact | Likelihood |
|------|--------|------------|
| Product rule ambiguity on age/weight thresholds for transitions | HIGH | HIGH — rules not specified |
| Category×sex consistency breaking existing animals in DB | MEDIUM | MEDIUM — may need migration |
| Offline sync complexity with category changes | MEDIUM | MEDIUM — needs careful design |
| `sex` field addition to `AnimalItem` breaking existing offline snapshots | MEDIUM | LOW — nullable, additive |
| Large scope causing SDD to stall | HIGH | MEDIUM — consider Approach C if scope too large |

---

## 8. Open Questions (for sdd-propose / orchestrator)

1. **Transition triggers**: Are TERNERO→TORO/VAQUILLONA transitions event-driven (user explicitly records) or automatic (based on age/weight)?
2. **BIRTH event**: Does recording a BIRTH event on a VAQUILLONA auto-upgrade it to VACA, or is that a separate manual update?
3. **Castration**: Confirm `CASTRATION` as the event type name, and whether it's a new `AnimalEventType` or a reproduction event.
4. **Category×sex enforcement**: Should the API reject invalid combinations (e.g., `VACA` + `MACHO`) at create/update time?
5. **Scope priority**: If Approach A is too large, which is more important — table UI or category expansion?

---

## Ready for Proposal

**Yes, but with open product questions** on transition rules before `sdd-spec`. The UI direction and category model are clear. The auto-transition logic needs product clarification.

The orchestrator should surface questions 1-5 to the user before launching `sdd-propose`.
