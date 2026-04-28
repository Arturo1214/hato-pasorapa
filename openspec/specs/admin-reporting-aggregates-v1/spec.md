# admin-reporting-aggregates-v1 Specification

## Purpose

Definir métricas administrativas agregadas V1 derivadas localmente desde snapshots offline.

## Requirements

### Requirement: Local aggregated metrics contract

The system MUST compute admin aggregates only from local snapshots of `USER`, `GANADERO`, and `ANIMAL` and SHALL expose at least total users, total ganaderos, total animales, and animales activos.

#### Scenario: Aggregates available without connectivity

- GIVEN snapshots `USER`, `GANADERO`, and `ANIMAL` already stored locally
- WHEN an admin opens reporting while offline
- THEN aggregate counters are displayed from local data
- AND no backend reporting endpoint is required for V1 rendering

### Requirement: Bounded windows and predefined V1 filters

The system MUST support only predefined V1 windows (`7d`, `30d`, `90d`) and predefined filter presets declared by product; arbitrary/ad-hoc filter composition MUST NOT be accepted in V1. Presets SHALL include lot dimension and explicit include/exclude lists for productivity and cost categories. For decision-support comparisons, the system SHALL provide deterministic period-vs-period outputs derived from the same bounded-window policy.

#### Scenario: Predefined filter preset is accepted

- GIVEN an admin selects a declared V1 preset
- WHEN reporting recomputes aggregates
- THEN the result reflects that preset and selected bounded window

#### Scenario: Ad-hoc filter is rejected

- GIVEN an admin attempts a filter not present in V1 presets
- WHEN the request is evaluated by reporting state
- THEN the ad-hoc filter is not applied
- AND the UI keeps using a valid predefined preset

#### Scenario: Explicit exclusions are applied

- GIVEN a preset with excluded productivity/cost categories
- WHEN aggregates are computed
- THEN excluded records are omitted from totals

#### Scenario: Period comparison uses bounded and aligned windows

- GIVEN two comparison periods are requested for decision support
- WHEN aggregates are generated
- THEN both periods are computed using declared bounded windows only
- AND the comparison output is deterministic across repeated runs
