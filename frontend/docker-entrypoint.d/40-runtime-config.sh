#!/bin/sh
set -eu

# Accept either the existing VITE_* names or concise Kubernetes key names.
export VITE_ENTRA_CLIENT_ID="${VITE_ENTRA_CLIENT_ID:-${ENTRA_CLIENT_ID:-}}"
export VITE_ENTRA_TENANT_ID="${VITE_ENTRA_TENANT_ID:-${ENTRA_TENANT_ID:-}}"
export VITE_ENTRA_API_SCOPE="${VITE_ENTRA_API_SCOPE:-${ENTRA_API_SCOPE:-}}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-${API_BASE_URL:-}}"
export VITE_API_TIMEOUT_MS="${VITE_API_TIMEOUT_MS:-${API_TIMEOUT_MS:-70000}}"

envsubst \
  '${VITE_ENTRA_CLIENT_ID} ${VITE_ENTRA_TENANT_ID} ${VITE_ENTRA_API_SCOPE} ${VITE_API_BASE_URL} ${VITE_API_TIMEOUT_MS}' \
  < /etc/conversational-bi/runtime-config.js.template \
  > /usr/share/nginx/html/runtime-config.js
