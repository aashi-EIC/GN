#!/bin/sh
set -eu

export VITE_API_BASE_URL="${VITE_API_BASE_URL:-${API_BASE_URL:-}}"
export VITE_API_TIMEOUT_MS="${VITE_API_TIMEOUT_MS:-${API_TIMEOUT_MS:-315000}}"

envsubst \
  '${VITE_API_BASE_URL} ${VITE_API_TIMEOUT_MS}' \
  < /etc/conversational-bi/runtime-config.js.template \
  > /usr/share/nginx/html/runtime-config.js
