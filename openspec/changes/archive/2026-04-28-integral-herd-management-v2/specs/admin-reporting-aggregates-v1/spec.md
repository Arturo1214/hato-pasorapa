# Delta for admin-reporting-aggregates-v1

## MODIFIED Requirements

### Requirement: Bounded windows and predefined V1 filters

The system MUST support predefined windows (`7d`,`30d`,`90d`) and product presets with lot dimension and explicit include/exclude lists for productivity and cost categories; ad-hoc filter composition MUST NOT be accepted in V1.
(Previously: admitía `7d`/`30d` y presets sin dimensión lote ni exclusiones explícitas.)

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
