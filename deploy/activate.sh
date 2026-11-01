#!/usr/bin/env bash
set -Eeuo pipefail
staging=${1:?Provide staging directory}
cd /opt/apps/gwent-classic-online
exec 9>.deploy.lock
flock -w 300 9
new_tag=$(cat "$staging/TAG")
[[ "$new_tag" =~ ^[0-9a-f]{40}$ ]]
previous_tag=$(cat TAG 2>/dev/null || true)
export TAG="$new_tag"
# Validate required production keys before changing the active compose file / containers.
docker compose --project-directory "$PWD" -f "$staging/docker-compose.production.yml" config --quiet
docker load < "$staging/images.tar.gz"
if [[ -f docker-compose.production.yml ]]; then
  cp docker-compose.production.yml "$staging/previous-compose.yml"
fi
cp "$staging/docker-compose.production.yml" docker-compose.production.yml
if ! docker compose -f docker-compose.production.yml up -d --wait --wait-timeout 180; then
  if [[ -n "$previous_tag" ]]; then
    cp "$staging/previous-compose.yml" docker-compose.production.yml
    TAG="$previous_tag" docker compose -f docker-compose.production.yml up -d --wait --wait-timeout 180
  fi
  exit 1
fi
printf '%s\n' "$new_tag" > TAG
rm -f "$staging/images.tar.gz"
