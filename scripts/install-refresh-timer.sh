#!/bin/sh
set -eu

# Installs the repository-owned systemd units and enables the weekly timer.
# This script must run on the home server from the checked-out project.
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
units_dir="$project_root/deploy/systemd"

if [ "$(id -u)" -eq 0 ]; then
  privilege=
else
  privilege=sudo
fi

$privilege install -m 0644 "$units_dir/melbourne-transport-radar-refresh.service" /etc/systemd/system/
$privilege install -m 0644 "$units_dir/melbourne-transport-radar-refresh.timer" /etc/systemd/system/
$privilege systemctl daemon-reload
$privilege systemctl enable --now melbourne-transport-radar-refresh.timer
$privilege systemctl status melbourne-transport-radar-refresh.timer --no-pager
