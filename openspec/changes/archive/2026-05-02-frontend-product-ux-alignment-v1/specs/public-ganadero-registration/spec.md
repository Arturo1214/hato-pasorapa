# Delta for public-ganadero-registration

## ADDED Requirements

### Requirement: Public ganadero registration with autologin

The system MUST provide a public (no auth required) registration endpoint `POST /api/public/ganaderos` that creates a Ganadero entity and a linked Usuario with GANADERO role, returning a JWT for immediate client login.

#### Scenario: Successful registration creates user and returns JWT

- GIVEN a public user submits POST `/api/public/ganaderos` with businessIdentifier, name, email, password
- WHEN validation passes (anti-spam included)
- THEN Ganadero entity is created, linked Usuario record has GANADERO role and is enabled
- AND HTTP 201 is returned with JWT token in response body
- AND no email verification is required

#### Scenario: Registration fails for duplicate email or businessIdentifier

- GIVEN a user attempts to register with an email already in use
- WHEN backend checks uniqueness constraints
- THEN HTTP 409 is returned with conflict error
- AND no user is created

#### Scenario: Registration requires email and CI fields when both are needed for login

- GIVEN public registration is configured to allow login via email OR CI
- WHEN user submits registration form
- THEN fields `businessIdentifier` (CI, used as alternative login) and `email` are both required
- AND `businessIdentifier` must be unique across all ganadero users

### Requirement: Anti-spam V1 — honeypot, timing, rate limit

The system MUST reject registration requests that fail honeypot, timing, or rate limit checks without exposing the specific failure reason to the client.

#### Scenario: Honeypot field rejects bot

- GIVEN a bot fills the hidden `website` field
- WHEN POST `/api/public/ganaderos` is received
- THEN request is rejected with HTTP 400
- AND generic error "Error en el registro, intenta más tarde" is returned

#### Scenario: Timing validation rejects fast bots

- GIVEN `formIssuedAt` is sent with value less than 3 seconds before request time
- WHEN server evaluates timing constraint
- THEN request is rejected HTTP 400
- AND generic error is returned (no mention of timing)

#### Scenario: Rate limit blocks excessive registrations

- GIVEN more than 3 registration attempts from same IP in 15 minutes
- WHEN POST `/api/public/ganaderos` is received
- THEN HTTP 429 is returned with retry-after header
- AND generic error is returned

### Requirement: FE registration form with anti-spam fields

The system MUST provide a frontend registration form containing visible fields (businessIdentifier, name, email, password, confirmPassword) plus hidden anti-spam fields (honeypot website, formIssuedAt timing).

#### Scenario: Registration form renders with honeypot and timing

- GIVEN user navigates to `/registro` (or `/ganadero/registro`)
- WHEN form is displayed
- THEN visible fields render for businessIdentifier, name, email, password, confirmPassword
- AND hidden honeypot field `website` is present (tabindex=-1, visually hidden)
- AND `formIssuedAt` timestamp is set to current Date.now() on form render

#### Scenario: FE submits registration with anti-spam payload

- GIVEN user fills all visible fields and submits
- WHEN form is valid and submitted
- THEN payload includes visible fields PLUS `website` (empty/null) AND `formIssuedAt` (timestamp from form render)
- AND on success, JWT is stored and user is redirected to `/admin/dashboard`

### Requirement: Ganadero profile with data completion and password change

The system MUST provide a `/perfil` route where authenticated GANADERO users can complete missing fields and change their password using their current password.

#### Scenario: Ganadero completes profile data

- GIVEN authenticated GANADERO is on `/perfil`
- WHEN user fills telefono, direccion fields and submits
- THEN Ganadero entity is updated with new contact data
- AND success confirmation is shown

#### Scenario: Password change requires current password

- GIVEN authenticated GANADERO is on `/perfil`
- WHEN user fills currentPassword, newPassword, confirmPassword and submits
- THEN currentPassword is verified against stored hash
- AND if valid, password is updated to newPassword
- AND if invalid, error "Contraseña actual incorrecta" is shown