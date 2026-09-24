#!/usr/bin/env bash
# One-shot installer for Raspberry Pi OS (64-bit, "with desktop"), run as the normal user (not root):
#
#   curl -fsSL https://raw.githubusercontent.com/jack-distl/home-system/main/deploy/install.sh | bash
#   (or, if you've already cloned the repo:  bash deploy/install.sh)
#
# It installs Node.js, builds the planner, starts it on boot, and opens it full-screen on the touchscreen.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/jack-distl/home-system.git}"
APP_DIR="${APP_DIR:-$HOME/home-system}"
NODE_MAJOR=22

echo "==> Installing system packages"
sudo apt-get update
sudo apt-get install -y git curl ca-certificates wlr-randr
# The browser package is "chromium" on newer Raspberry Pi OS and "chromium-browser" on older releases.
sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]; then
  echo "==> Installing Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> Downloading the planner"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> Building"
npm ci
npm run build
[ -f .env ] || cp .env.example .env

echo "==> Starting the planner on boot (systemd)"
sudo tee /etc/systemd/system/home-planner.service >/dev/null <<UNIT
[Unit]
Description=Home planner
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$(command -v npm) start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now home-planner

echo "==> Opening full-screen on login"
chmod +x deploy/*.sh
AUTOSTART_LINE="$APP_DIR/deploy/kiosk.sh &"
# Raspberry Pi OS Bookworm/Trixie uses the labwc Wayland compositor.
mkdir -p "$HOME/.config/labwc"
touch "$HOME/.config/labwc/autostart"
grep -qF "$AUTOSTART_LINE" "$HOME/.config/labwc/autostart" || echo "$AUTOSTART_LINE" >> "$HOME/.config/labwc/autostart"

echo "==> Screen schedule and nightly updates (cron)"
( crontab -l 2>/dev/null | grep -v 'home-system/deploy' || true
  echo "* * * * * $APP_DIR/deploy/display-schedule.sh >/dev/null 2>&1"
  echo "30 3 * * * $APP_DIR/deploy/update.sh >> $HOME/planner-update.log 2>&1"
) | crontab -

echo "==> Setting the clock to Perth time"
sudo timedatectl set-timezone "${PLANNER_TZ:-Australia/Perth}" || true

echo "==> Turning off the desktop's own screen blanking (the planner handles art mode and night-time)"
sudo raspi-config nonint do_blanking 1 || true
# Log straight into the desktop after power cuts.
sudo raspi-config nonint do_boot_behaviour B4 || true

cat <<DONE

All done. The planner is running at http://localhost:3000
From a phone on the same Wi-Fi: http://$(hostname).local:3000

Next: reboot (sudo reboot) and it will open full-screen.
Then connect your calendars — see docs/03-calendars.md.
DONE
