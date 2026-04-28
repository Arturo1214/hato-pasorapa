# admin-notification-local-read-state-v1 Specification

## Purpose

Definir el estado local `leída/no leída` por dispositivo y su consistencia con inbox/badge sin sincronización cross-device en V1.

## Requirements

### Requirement: Local read-state per device

The client MUST maintain read-state locally per device for each notification ID, independent of backend canonical data and independent across devices.

#### Scenario: Mark notification as read offline

- GIVEN a notification exists in local inbox as unread
- WHEN the user marks it as read without connectivity
- THEN the device stores read-state locally
- AND the state persists across app restart on that same device

#### Scenario: Read-state does not replicate to another device

- GIVEN the same user opens a second device
- WHEN the second device syncs notifications
- THEN read-state from the first device is not assumed or imported

### Requirement: Unread counter and badge consistency

The client SHALL compute unread counts from local read-state and SHALL show a consistent badge count in navigation and inbox list.

#### Scenario: Badge decreases when item is marked read

- GIVEN unread badge count N>0
- WHEN one unread notification is marked read
- THEN badge count becomes N-1
- AND inbox reflects the same read-state immediately

### Requirement: Merge behavior on incremental updates

The client MUST preserve existing local read-state when merging incremental notification pulls and MUST initialize unseen notification IDs as unread.

#### Scenario: Refresh merges without losing local read-state

- GIVEN local inbox contains notification A marked read
- WHEN incremental pull returns notification A unchanged plus new notification B
- THEN A remains read locally
- AND B is added as unread by default
