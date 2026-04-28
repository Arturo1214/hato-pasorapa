# Delta for admin-reporting-operational-events-v1

## MODIFIED Requirements

### Requirement: Explicit V1 exclusions for operational reporting

The operational reporting scope MUST NOT include drill-down libre, configurable dashboards, complex exports (PDF/Excel), scheduled reports, predictive analytics, optimization recommendations, or automatic decision suggestions in V1. It MUST NOT trigger automatic execution of actions and SHALL keep decision outcomes manual and explainable.

(Previously: predictive/optimization and automatic suggestions were excluded, but explicit prohibition of automatic execution and manual/explicable decision outcome was not stated.)

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
