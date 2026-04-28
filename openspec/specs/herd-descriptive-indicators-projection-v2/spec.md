# herd-descriptive-indicators-projection-v2 Specification

## Purpose

Proyecciones locales de KPIs descriptivos admin.

## Requirements

### Requirement: Local descriptive KPI projection with bounded windows

The system MUST compute KPIs from local lot/productivity/cost ledgers, SHALL support only windows (`7d`,`30d`,`90d`), and MUST NOT generate predictive outputs. Derived KPI signals for decision support SHALL include explanatory metadata (source and rule) and MUST remain descriptive-only.

#### Scenario: Compute descriptive indicators offline

- GIVEN local ledgers exist
- WHEN admin opens indicators offline
- THEN descriptive trend/comparative KPIs are rendered

#### Scenario: Request outside allowed windows

- GIVEN a non-declared window request
- WHEN projection runs
- THEN the request is rejected

#### Scenario: Signal exposes explanation fields

- GIVEN a KPI signal is produced for decision support
- WHEN signal details are queried
- THEN source datasets and applied descriptive rule are present
- AND no predictive score/forecast field is returned
