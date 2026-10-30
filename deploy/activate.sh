#!/usr/bin/env bash
set -Eeuo pipefail
staging=${1:?Provide staging directory}
cd /opt/apps/gwent-classic-online
exec 9>.deploy.lock
flock -w 300 9
new_tag=$(cat "$staging/TAG")
[[ "$new_tag" =~ ^[0-9a-f]{40}$ ]]
previous_tag=$(cat TAG 2>/dev/null || true)
docker load < "$staging/images.tar.gz"
cp "$staging/docker-compose.production.yml" docker-compose.production.yml
export TAG="$new_tag"
if ! docker compose -f docker-compose.production.yml up -d --wait --wait-timeout 180; then
  if [[ -n "$previous_tag" ]]; then
    TAG="$previous_tag" docker compose -f docker-compose.production.yml up -d --wait --wait-timeout 180
  fi
  exit 1
fi
printf '%s\n' "$new_tag" > TAG
rm -f "$staging/images.tar.gz"
