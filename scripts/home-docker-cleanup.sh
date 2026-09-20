#!/usr/bin/env bash

# Remove only dangling Docker images created by this Compose project. This
# deliberately does not run Docker's global prune commands because the server
# hosts other applications.
set -euo pipefail

readonly project_label='com.docker.compose.project=melbourne-train-planner'
declare -a image_ids=()

while IFS= read -r image_id; do
  labels="$(docker image inspect --format '{{range $key, $value := .Config.Labels}}{{$key}}={{$value}} {{end}}' "$image_id")"
  if [[ " $labels" == *" $project_label "* ]]; then
    image_ids+=("$image_id")
  fi
done < <(docker image ls --filter dangling=true --quiet | sort -u)

if (( ${#image_ids[@]} == 0 )); then
  echo 'No unreferenced Melbourne Transport Radar images to remove.'
  exit 0
fi

echo "Removing ${#image_ids[@]} unreferenced Melbourne Transport Radar image(s)."
docker image rm "${image_ids[@]}"
