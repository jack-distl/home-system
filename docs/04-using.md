# 4. Everyday use & looking after it

## On the wall

- **Asleep (art mode):** after 2 minutes without a touch (adjustable), the screen fades to a gallery of paintings. **Touch anywhere** to wake it; that first touch never presses a button by accident.
- **Week view:** today plus the next six days. Tap an empty part of a day to add an event there, or tap an event to edit it. **Month view** gives the bigger picture; tap a day to jump to that week.
- **Lists** on the right: Shopping, To do, To buy and Meals to start with. Tap to tick, and ticked items disappear after a day. **Settings → Lists** lets you add ones like "Chores" or "Gift ideas", rename them and change their emoji.
- **Night:** the screen turns fully off from 10:30pm to 6:00am. Change the times in Settings.

## From your phones

Open **http://planner.local:3000** on home Wi-Fi and use **Share → Add to Home Screen** to make it an app icon. The layout switches to lists-first on a phone, perfect for "we're out of milk".

> Away from home, keep using your normal Calendar app. It syncs to the wall anyway. To reach the lists from outside the house, see *Remote access* in the [roadmap](roadmap.md).

## Your own art

Copy images (JPG/PNG, landscape works best) into the `art/` folder on the Pi. From a Mac or PC:

```bash
scp ~/Pictures/wall/*.jpg family@planner.local:~/home-system/art/
```

- **Settings → Screen → Art** lets you choose between *your art folder + public-domain paintings* (from the Art Institute of Chicago's open collection) and *only your folder*.
- **"Paintings of"** changes the theme, e.g. `sea`, `impressionism`, `Monet`, `flowers`, `Japanese`.

## Updates

The Pi checks GitHub at 3:30am each night. If there's anything new on `main`, it installs it and the screen reloads itself. To update right now:

```bash
ssh family@planner.local
~/home-system/deploy/update.sh --force
```

## Backups

Your calendars live in Google/iCloud, so they're safe regardless. The Pi only holds your **lists, settings and connected accounts**. To keep a copy:

```bash
~/home-system/deploy/backup.sh
```

This keeps 30 dated copies in `~/planner-backups`. To run it weekly, add it to `crontab -e`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Screen is black | Tap it; it may be in night mode. Check the Pi's power light. |
| "⚠" next to an account in Settings | The password was revoked or Google disconnected it. Disconnect and reconnect it. |
| Phone changes aren't showing | Tap ⟳. Check the account's "Synced" time in Settings. |
| Touch doesn't work | Check the USB cable between the Pi and the monitor. |
| Everything is frozen | Pull the Pi's power for 10 seconds. It boots straight back into the planner. |
| Can't reach planner.local | Some routers don't support `.local` names. Use the Pi's IP address from your router's app, e.g. `http://192.168.1.50:3000`. |

Handy commands over SSH:

```bash
sudo systemctl status home-planner     # is it running?
journalctl -u home-planner -n 100      # recent logs
sudo systemctl restart home-planner    # restart the app
```

## Privacy & security

- Everything runs on the Pi in your house. There's no cloud service in the middle and no subscription.
- The Pi talks only to Google/Apple (your calendars), Open-Meteo (weather) and the Art Institute of Chicago (paintings).
- Anyone on your home Wi-Fi can open the planner, same as walking up to the screen. It is **not** exposed to the internet.
- iCloud app-specific passwords and Google tokens are stored in the database on the Pi's SD card. Revoke them from Apple/Google if you ever lose the device.
