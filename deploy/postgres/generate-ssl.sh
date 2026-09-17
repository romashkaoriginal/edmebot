#!/bin/sh
set -e

CERT_DIR="$PGDATA"
mkdir -p "$CERT_DIR"

openssl req -new -x509 -days 3650 -nodes -text \
  -out "$CERT_DIR/server.crt" \
  -keyout "$CERT_DIR/server.key" \
  -subj "/CN=edmepets-db"

chmod 600 "$CERT_DIR/server.key"
chown postgres:postgres "$CERT_DIR/server.key" "$CERT_DIR/server.crt"
