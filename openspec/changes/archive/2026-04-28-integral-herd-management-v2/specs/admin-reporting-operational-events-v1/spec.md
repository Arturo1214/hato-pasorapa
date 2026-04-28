# Delta for admin-reporting-operational-events-v1

## MODIFIED Requirements

### Requirement: Explicit V1 exclusions for operational reporting

The operational reporting scope MUST NOT include drill-down libre, configurable dashboards, complex exports (PDF/Excel), scheduled reports, predictive analytics, optimization recommendations, or automatic decision suggestions in V1/V2.
(Previously: no explicitaba exclusión de optimización y recomendaciones automáticas.)

#### Scenario: User attempts excluded capability

- GIVEN an admin attempts an excluded reporting feature
- WHEN the action is evaluated in V1
- THEN the feature is unavailable in this capability
- AND no advanced reporting artifact is generated

#### Scenario: User attempts optimization-oriented view

- GIVEN an admin requests recommendation or optimization outputs
- WHEN scope validation runs
- THEN the request is rejected as out-of-scope
