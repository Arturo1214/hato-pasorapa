# analytics-decision-support-v1 Specification

## Purpose

Brindar soporte de decisión operativo **descriptivo, explicable y local-first** para priorizar acciones manuales diarias/semanales.

## Requirements

### Requirement: Local-first decision support dashboard

The system MUST provide an `admin/decision-support` dashboard that works from local snapshots, SHALL remain functional offline, and MUST NOT require external integrations for core rendering.

#### Scenario: Dashboard available offline

- GIVEN local snapshots were previously synchronized
- WHEN an admin opens decision support without connectivity
- THEN insight cards are rendered from local derived state
- AND no external API call is required to show baseline insights

#### Scenario: Sync-safe refresh after connectivity returns

- GIVEN decision support was used offline
- WHEN connectivity returns and sync completes
- THEN insights are recomputed safely without duplicated cards
- AND user selections remain in a valid local state

### Requirement: Actionable descriptive insights with traceability

The system MUST present actionable descriptive insights and SHALL include, per insight, data source, applied rule, and temporal window.

#### Scenario: Insight explains source and rule

- GIVEN a cost deviation insight is shown
- WHEN the admin opens insight details
- THEN source datasets are listed
- AND the applied descriptive rule and window are visible

### Requirement: Temporal consistency and bounded windows

The system MUST support only bounded windows (`7d`, `30d`, `90d`) and SHALL enforce consistency between `occurredAt` event timestamps and `periodKey`-based aggregates when comparing periods.

#### Scenario: Mixed sources remain temporally consistent

- GIVEN events use `occurredAt` and ledgers use `periodKey`
- WHEN a period-vs-period comparison is computed
- THEN records are normalized to the selected bounded window
- AND out-of-window records are excluded deterministically

### Requirement: Local performance budget for decision insights

The system SHOULD use local cache and incremental recomputation so that repeated renders with unchanged inputs remain responsive on field devices.

#### Scenario: Re-open without data changes

- GIVEN local inputs did not change since last computation
- WHEN the admin re-opens decision support
- THEN cached or incrementally updated insights are reused
- AND full recomputation is avoided

### Requirement: Explicit anti-predictive and manual-decision guardrails

The system MUST NOT provide predictive BI outputs, MUST NOT provide automatic optimization, MUST NOT create external integrations for insights, and SHALL keep final decisions manual and explainable.

#### Scenario: Predictive request is rejected

- GIVEN a request for forecast, score, or next-best-action
- WHEN scope validation runs for this capability
- THEN the request is rejected as out-of-scope

#### Scenario: Automatic recommendation execution is blocked

- GIVEN an admin attempts auto-apply/auto-optimize action
- WHEN action policy is evaluated
- THEN automatic execution is unavailable
- AND only manual follow-up actions are presented
