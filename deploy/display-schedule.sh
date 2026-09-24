#!/usr/bin/env bash
# Run every minute by cron. Turns the HDMI output off overnight and back on in the morning,
# using the "Screen off from/to" times in the planner's Settings.
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"

OUTPUT=$(wlr-randr 2>/dev/null | awk '/^[A-Z]/{print $1; exit}')
[ -n "$OUTPUT" ] || exit 0

if curl -fs http://localhost:3000/api/display | grep -q '"on":false'; then
  wlr-randr --output "$OUTPUT" --off
else
  wlr-randr --output "$OUTPUT" --on
fi
