#!/bin/sh
set -eu

KC="/opt/keycloak/bin/kcadm.sh"
URL="${KEYCLOAK_URL:-http://keycloak:8080/auth}"
REALM="${KEYCLOAK_REALM:-twisted-vault}"

until "$KC" config credentials --server "$URL" --realm master --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null 2>&1; do
  sleep 5
done

until "$KC" get "realms/$REALM" >/dev/null 2>&1; do
  sleep 3
done

user_id() {
  "$KC" get users -r "$REALM" --fields id,username |
    awk -v username="$ADMIN_USERNAME" '
      /"id"/ { gsub(/[",]/, "", $3); id = $3 }
      /"username"/ { gsub(/[",]/, "", $3); if ($3 == username) { print id; exit } }
    '
}

ID="$(user_id)"
if [ -z "$ID" ]; then
  ID="$("$KC" create users -r "$REALM" -i -s username="$ADMIN_USERNAME" -s email="$ADMIN_EMAIL" -s enabled=true -s emailVerified=true)"
else
  "$KC" update "users/$ID" -r "$REALM" -s username="$ADMIN_USERNAME" -s email="$ADMIN_EMAIL" -s enabled=true -s emailVerified=true >/dev/null
fi

if [ -z "$ID" ]; then
  echo "Keycloak user '$ADMIN_USERNAME' was not found or created" >&2
  exit 1
fi

"$KC" set-password -r "$REALM" --userid "$ID" --new-password "$ADMIN_PASSWORD"
echo "Keycloak user '$ADMIN_USERNAME' synced"
