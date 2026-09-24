# 1. Shopping list (Perth, WA)

Prices were checked online on **24 Sep 2026** and are in AUD. Most retailer sites don't show stock for individual Perth stores, so **ring or use click-and-collect before you drive anywhere**.

## What you're building

```
 ┌───────────────────────────── wall ─────────────────────────────┐
 │   ┌───────────────────────────────────────────────┐            │
 │   │  24" touchscreen (landscape, VESA-mounted)    │            │
 │   │                                               │            │
 │   └───────────────────────────────────────────────┘            │
 │        ▲ HDMI (video)   ▲ USB (touch)                          │
 │        └──── Raspberry Pi 5 (stuck to the back of the screen) ─┘
 │                    ▲ USB-C power       screen ▲ power          │
 └──────────────────── power point (behind or below the screen) ──┘
```

The Pi runs the planner app and shows it full-screen. Your phones talk to Google/iCloud as usual, and the Pi syncs with those same calendars every few minutes.

## Option A: recommended (about $750–$900 all up)

| # | Item | Pick | Price | Where in Perth |
|---|------|------|-------|----------------|
| 1 | **Touchscreen** | **HP E24t G5** (23.8", 1080p IPS, 10-point touch, **matte anti-glare**, 75 Hz). The touch layer is built into the panel with no glass on top, so it's the least reflective option and best for the "art on the wall" look. | ~$389 | **Umart Belmont** (26 Wheeler St), **MSY** |
|   | *or* | **Dell P2424HT** (23.8", anti-glare hard-coated glass, edge-to-edge, USB-C). Slightly nicer build, a bit more reflective. | ~$415 | Umart Belmont, MSY (Scorptec online $435) |
| 2 | **Computer** | **Raspberry Pi 5, 4GB** (plenty for this). Get the 8GB if that's all they have. | 4GB ~$189 / 8GB ~$339 | **Jaycar** (many Perth stores), **Altronics** (Northbridge, Balcatta, Cannington, Midland, Myaree, Joondalup) |
| 3 | Pi power supply | **Official Raspberry Pi 27W USB-C** (use this one; cheap phone chargers cause random crashes) | ~$21–35 | Jaycar / Altronics |
| 4 | Cooling | **Official Pi 5 Active Cooler** (~$12) or **official Pi 5 case with fan** (~$19) | ~$12–19 | Jaycar / Altronics |
| 5 | Storage | **SanDisk High Endurance 64GB microSD** (built for 24/7 use), or SanDisk Extreme 64GB | ~$40–65 | **Officeworks** |
| 6 | Video cable | **Micro-HDMI → HDMI**, 1–2 m (the Pi 5 has *micro* HDMI ports) | ~$15–30 | Jaycar / Altronics / JB |
| 7 | Touch cable | **USB-A → USB-B** (HP) or **USB-A → USB-C** (Dell), 1–2 m. Check the monitor box first, it may already include one. | ~$15 | Jaycar / Officeworks |
| 8 | Wall mount | **Brateck LULCD101G** (13–27", tilts and extends) | ~$30 | **Officeworks** |
|   | *or, for flatter to the wall* | Crest "Ultra Slim" fixed or "Small Tilt" bracket (VESA 100) | ~$30–50 | **Bunnings** |
| 9 | Stick-on | 3M Dual Lock or strong velcro, to mount the Pi on the back of the screen | ~$10 | Bunnings / Officeworks |
| 10 | microSD reader | Only if your laptop has no SD slot | ~$15 | Officeworks |

**You do NOT need** a keyboard or mouse. We set up Wi-Fi and remote access before the card ever goes into the Pi.

### Power: the one thing to think about before you drill

The screen and the Pi each need a power cable (two cables). For a clean look:

- **Tidiest:** have a **licensed electrician** fit a double power point behind the screen (in WA only a licensed electrician may do fixed wiring). It usually costs a couple of hundred dollars. Mount the screen over the power point and all cables are hidden.
- **No electrician:** mount the screen just above a bench or cabinet with a power point, and run the cables down a paintable **cable cover channel** (Bunnings, ~$15).

## Option B: mini PC instead of a Pi

- **When to pick it:** you'd rather not deal with microSD cards, or you want **one USB-C cable** carrying video and touch to the Dell.
- **What to buy:** an Intel N100/N150 mini PC (Minisforum, Beelink, Trigkey etc.). They're around $250–350 on Amazon AU but take a few days to reach Perth. Umart/MSY have the MSI Cubi N (N100) barebone for about $259, but you then need to add RAM and an SSD.
- **Setup:** install Ubuntu or Debian instead of Raspberry Pi OS. `deploy/install.sh` should mostly work unchanged, but it's written for and tested against Raspberry Pi OS.

## Bigger screen?

- **27" touch monitors** are rare and pricey. The **ViewSonic TD2760** (~$999, Umart/MSY) is the closest to a Skylight Calendar Max in size.
- The software doesn't care about size. Start with 24" and upgrade later if you like; the Pi and the app move over unchanged.

## Why not a Samsung Frame TV?

- It looks lovely, but it isn't a touchscreen.
- Its Art Mode only shows Samsung's own art store, not a web page.
- Clip-on touch frames add a thick raised bezel and feel imprecise.

A matte touch monitor plus the planner's built-in art mode gets you the same "painting on the wall" effect for less.

## Shopping run, in order

1. **Umart Belmont** (or MSY): the HP E24t G5 or Dell P2424HT. Order online for in-store pickup first to lock in stock.
2. **Jaycar / Altronics**: Pi 5, official 27W PSU, Active Cooler or case, micro-HDMI cable, USB cable.
3. **Officeworks**: SanDisk High Endurance microSD, Brateck mount, card reader if needed, Dual Lock.
4. **Bunnings** (optional): cable cover channel, wall plugs/screws suited to your wall (plasterboard anchors vs masonry).

Next: [2. Set up the Pi and mount the screen →](02-setup.md)
