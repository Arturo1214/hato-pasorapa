# herd-descriptive-indicators-projection-v2 Specification

## Purpose
Proyecciones locales de KPIs descriptivos admin.

## Requirements

### Requirement: Local descriptive KPI projection with bounded windows

The system MUST compute KPIs from local lot/productivity/cost ledgers, SHALL support only windows (`7d`,`30d`,`90d`), and MUST NOT generate predictive outputs.

#### Scenario: Compute descriptive indicators offline

- GIVEN local ledgers exist
- WHEN admin opens indicators offline
- THEN descriptive trend/comparative KPIs are rendered

#### Scenario: Request outside allowed windows

- GIVEN a non-declared window request
- WHEN projection runs
- THEN the request is rejected
