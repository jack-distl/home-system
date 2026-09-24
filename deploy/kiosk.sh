#!/usr/bin/env bash
# Opens the planner full-screen. Started by labwc on login (see install.sh).

# Wait for the planner to come up after boot.
for _ in $(seq 1 60); do
  curl -fs http://localhost:3000/api/status >/dev/null && break
  sleep 2
done

BROWSER=$(command -v chromium || command -v chromium-browser)
exec "$BROWSER" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=Translate,TouchpadOverscrollHistoryNavigation \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  --check-for-update-interval=31536000 \
  --password-store=basic \
  --ozone-platform=wayland \
  "http://localhost:3000/?kiosk=1"
