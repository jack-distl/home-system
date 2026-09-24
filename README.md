# Home Planner

A wall-mounted family planner for a touchscreen, like a [Skylight Calendar Max](https://au.myskylight.com/calendar-max/). You buy the hardware once, pay no subscription, and it runs on a Raspberry Pi at home.

- **When nobody's using it:** it shows public-domain paintings or your own images, like a framed print.
- **When you touch it:** it wakes up as a family planner:
  - **Calendar**, week and month views, **two-way synced** with your phones' Google and iCloud calendars, colour-coded by person
  - **Lists**: shopping, to-do, to-buy, meals, or whatever you add
  - **Weather**, a big clock, and an on-screen keyboard
- **At night:** the screen switches itself off.
- **From your phone:** open `http://planner.local:3000` on home Wi-Fi to add to lists.

## Start here

1. [**Shopping list**](docs/01-shopping-list.md): what to buy in Perth and where (~$750–900 total)
2. [**Set up the Pi and mount the screen**](docs/02-setup.md)
3. [**Connect your calendars**](docs/03-calendars.md): iCloud and Google
4. [**Everyday use & looking after it**](docs/04-using.md)
5. [Roadmap](docs/roadmap.md)

## How it works

```
 Phones ──(normal Calendar apps)──▶ Google Calendar / iCloud ◀──(sync every 5 min + on every edit)──┐
                                                                                                    │
 ┌──────────────────────────── Raspberry Pi 5 on the back of the screen ───────────────────────────┐
 │  server/  Node.js (Fastify) + built-in SQLite                                                   │
 │    • providers/google.ts   Google Calendar REST API (OAuth)                                     │
 │    • providers/caldav.ts   iCloud & other CalDAV (tsdav + ical.js, expands repeating events)    │
 │    • sync.ts               caches events locally so the screen is instant and works offline     │
 │    • lists, settings, art (Art Institute of Chicago open API), weather (Open-Meteo)             │
 │  web/     React UI, served by the same server, shown full-screen by Chromium in kiosk mode      │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Developing

Needs Node.js 22.18+.

```bash
npm install
npm run dev        # server on :3000, UI with hot reload on http://localhost:5173
npm test           # unit tests
npm run typecheck
```

- Add `?kiosk=1` to the URL to get the on-screen keyboard, as on the wall.
- Copy `.env.example` to `.env` for Google credentials and your location.

To ship a change: push to `main`. The Pi pulls it at 3:30am, or run `deploy/update.sh --force` on the Pi.

| Path | What |
|---|---|
| `server/` | API, sync engine, calendar providers |
| `web/src/` | Touchscreen UI |
| `shared/types.ts` | Types used by both |
| `deploy/` | Pi installer, kiosk launcher, night schedule, updater, backup |
| `art/` | Drop your own images here (not committed) |
| `data/` | SQLite database (not committed) |
