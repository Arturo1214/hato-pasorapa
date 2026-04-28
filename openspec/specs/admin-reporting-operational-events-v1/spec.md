# admin-reporting-operational-events-v1 Specification

## Purpose

Definir reportes operativos básicos V1 sobre eventos de animales, sin capacidades BI avanzadas.

## Requirements

### Requirement: Operational event counts by bounded window

The system MUST derive operational reports from local snapshots of `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, and `ANIMAL_REPRODUCTION_EVENT`, including counts by event type for `7d` and `30d` windows.

#### Scenario: Event counts for 7d and 30d

- GIVEN local snapshots with events in multiple dates
- WHEN reporting computes operational metrics
- THEN counts by event type are available for `7d` and `30d`
- AND counts outside each window are excluded from that window total

### Requirement: Basic recent activity list

The system SHALL expose a basic recent activity view sourced from local event snapshots and ordered from newest to oldest.

#### Scenario: Recent activity sorted descending

- GIVEN multiple local events with distinct timestamps
- WHEN recent activity is rendered
- THEN the first item is the newest event
- AND ordering remains deterministic for equal timestamps

### Requirement: Explicit V1 exclusions for operational reporting

The operational reporting scope MUST NOT include drill-down libre, configurable dashboards, complex exports (PDF/Excel), scheduled reports, predictive analytics, optimization recommendations, or automatic decision suggestions in V1. It MUST NOT trigger automatic execution of actions and SHALL keep decision outcomes manual and explainable.

#### Scenario: User attempts excluded capability

- GIVEN an admin attempts an excluded reporting feature
- WHEN the action is evaluated in V1
- THEN the feature is unavailable in this capability
- AND no advanced reporting artifact is generated

#### Scenario: User attempts optimization-oriented view

- GIVEN an admin requests recommendation or optimization outputs
- WHEN scope validation runs
- THEN the request is rejected as out-of-scope

#### Scenario: User attempts automatic action execution

- GIVEN an admin attempts "auto-apply" from an insight
- WHEN action policy is evaluated
- THEN execution is blocked in V1
- AND the UI requires a manual follow-up decision
