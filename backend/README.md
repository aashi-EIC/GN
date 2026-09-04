# Conversational BI BFF — No Authentication Edition

The BFF validates requests, applies rate limits and content-safety checks, manages shared workspace
sessions, and adapts requests and responses for the MCP host.

This edition intentionally performs no inbound user authentication. Every request receives the
same internal workspace identity so existing session and settings repositories remain consistent.
Deploy it only behind a trusted client-managed network or access gateway.

The outbound MCP connection supports:

- `MCP_AUTH_MODE=none`
- `MCP_AUTH_MODE=api-key`

Copy `.env.example` to `.env` and configure the MCP endpoint before starting the service.
