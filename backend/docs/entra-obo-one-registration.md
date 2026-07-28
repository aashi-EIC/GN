# Entra OBO Setup With One App Registration

This project can run the POC with one Microsoft Entra app registration shared by React and the Node BFF.

The same app registration is used in two different ways:

- React uses the public SPA configuration to sign users in.
- Node uses the protected API audience to validate tokens.
- Node uses the confidential client secret to perform OBO when `MCP_AUTH_MODE=obo`.

The frontend must never receive the client secret, MCP key, database URL, Redis URL or downstream tokens.

## Entra App Registration

Configure the single app registration with these areas:

- Authentication
  - Platform: Single-page application
  - Redirect URI for local React: `http://localhost:5173`
  - Redirect URI for deployed React: client-provided frontend URL

- Expose an API
  - Application ID URI: client-provided value, commonly `api://<client-id>`
  - Delegated scope: client-provided value, commonly `access_as_user`

- API permissions
  - Add only the downstream delegated permissions confirmed by the client.
  - Grant admin consent only after the client confirms the production downstream API contract.

- Certificates and secrets
  - Create a client secret or certificate for the Node BFF only.
  - Store this in the server environment or a secret manager, never in React.

## React Environment

Use public values only:

```env
VITE_ENTRA_CLIENT_ID=<same-app-registration-client-id>
VITE_ENTRA_TENANT_ID=<tenant-id>
VITE_ENTRA_API_SCOPE=<client-provided-api-scope>
```

Example shape only:

```env
VITE_ENTRA_API_SCOPE=api://<client-id>/access_as_user
```

## Node Environment For Inbound Validation

Node validates the access token sent by React:

```env
ENTRA_TENANT_ID=<tenant-id>
ENTRA_API_AUDIENCE=<client-provided-api-audience>
ENTRA_REQUIRED_SCOPE=<client-provided-scope-name>
```

Example shape only:

```env
ENTRA_API_AUDIENCE=api://<client-id>
ENTRA_REQUIRED_SCOPE=access_as_user
```

## Node Environment For OBO

Keep API-key mode while the MCP contract is still being tested:

```env
MCP_AUTH_MODE=api-key
```

When the client provides the downstream scope and confidential credential, switch to:

```env
MCP_AUTH_MODE=obo
OBO_TENANT_ID=
OBO_CLIENT_ID=<same-app-registration-client-id>
OBO_CLIENT_SECRET=<server-only-secret>
OBO_DOWNSTREAM_SCOPE=<client-provided-downstream-scope>
```

`OBO_TENANT_ID` may be left blank when it is the same as `ENTRA_TENANT_ID`.

`OBO_DOWNSTREAM_SCOPE` can contain one or more scopes separated by spaces or commas.

## Runtime Flow

1. React signs the user in with MSAL.
2. React requests an access token for the BFF API scope.
3. React calls only `/api/v1/*` on Node with `Authorization: Bearer <token>`.
4. Node validates issuer, audience, lifetime and required scope.
5. Node authorizes session ownership and semantic model consistency.
6. In API-key mode, Node calls MCP with the configured API key.
7. In OBO mode, Node exchanges the inbound user token for a downstream token.
8. Node calls MCP with the downstream bearer token.
9. Node validates and normalizes the MCP response before returning it to React.

## Values Still Required From The Client

Do not guess these:

- Deployed frontend redirect URI
- Entra tenant ID
- Application/client ID
- API Application ID URI and scope name
- Downstream OBO scope
- Client secret or certificate process
- MCP base URL and endpoint path
- MCP request field names
- MCP response field paths
- Semantic model IDs
- RLS claim or user identifier mapping
