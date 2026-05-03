# Delta for Authentication

## MODIFIED Requirements

### Requirement: Login redirect to dashboard

The system MUST redirect authenticated users to `/admin/dashboard` after successful login, instead of `/`.

(Previously: redirect to `/`)

#### Scenario: Login success redirects to dashboard

- GIVEN user is on `/login` with valid credentials
- WHEN user submits login form
- THEN after successful authentication the user is redirected to `/admin/dashboard`

## ADDED Requirements

### Requirement: Header logout button

The system MUST expose a logout button in the application header that terminates the authenticated session and redirects to `/login`.

#### Scenario: Logout clears session and redirects

- GIVEN user is authenticated with a valid JWT
- WHEN user clicks the logout button in the header
- THEN the JWT is cleared from storage, session is invalidated server-side, and user is redirected to `/login`

#### Scenario: Logout is accessible to all authenticated users

- GIVEN user has any valid role (ADMIN or GANADERO)
- WHEN header renders
- THEN logout button is visible in the header bar

### Requirement: Login accepts email or CI for ganadero users

The system MUST allow GANADERO users to authenticate using either their email address or their CI (businessIdentifier), without exposing any technical complexity about which identifier type is being used.

#### Scenario: Ganadero logs in with email

- GIVEN a GANADERO user has username = email@example.com
- WHEN user enters email@example.com and password in login form
- THEN authentication succeeds and JWT is returned

#### Scenario: Ganadero logs in with CI

- GIVEN a GANADERO user has businessIdentifier = "12345678" and no active username in the traditional sense
- WHEN user enters "12345678" and password in login form
- THEN backend resolves this against the user's email OR username field
- AND authentication succeeds and JWT is returned

#### Scenario: Login with invalid identifier shows generic error

- GIVEN user enters an identifier that does not exist in the system
- WHEN user submits login form
- THEN generic "Credenciales inválidas" error is returned
- AND no information is revealed about which identifier type was used