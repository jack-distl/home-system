# 2. Set up the Pi and mount the screen

Allow about an hour. Do it on the kitchen bench first and put it on the wall once everything works.

## Step 1: Prepare the microSD card (on your laptop, ~15 min)

1. Install **Raspberry Pi Imager** from <https://www.raspberrypi.com/software/>.
2. Put the microSD card in your laptop (use a card reader if needed).
3. In Imager choose:
   - **Device:** Raspberry Pi 5
   - **OS:** *Raspberry Pi OS (64-bit)*, the normal one **with desktop** (not "Lite")
   - **Storage:** your microSD card
4. When it asks about **OS customisation → Edit settings**, fill in:
   - **Hostname:** `planner` (so you can reach it at `planner.local`)
   - **Username / password:** e.g. `family` and a password you'll remember
   - **Wi-Fi:** your home network name and password. **Wireless LAN country: AU**
   - **Locale:** time zone `Australia/Perth`, keyboard `us`
   - **Services** tab: tick **Enable SSH** (use password authentication)
5. Write the card. It takes 5–10 minutes.

## Step 2: Put it together

1. Fit the **Active Cooler** to the Pi, or put the Pi in the case with fan.
2. Insert the microSD card into the Pi.
3. **Micro-HDMI → HDMI**: from the Pi's port **HDMI0** (the one nearest the USB-C power port) to the monitor.
4. **USB cable**: from any Pi USB port to the monitor's USB upstream port. This is what carries the touch.
5. Plug in the monitor's power, then the Pi's 27W power supply. The Pi turns on when it gets power.

After a minute or two you'll see the Raspberry Pi desktop, and touch should already work: tap the menu to check.

## Step 3: Install the planner (~10 min)

From your laptop (Terminal on Mac, PowerShell on Windows):

```bash
ssh family@planner.local
```

Type `yes` if asked, then the password you chose. Now paste this one line:

```bash
curl -fsSL https://raw.githubusercontent.com/jack-distl/home-system/main/deploy/install.sh | bash
```

> The repository is private, so `curl` can't read it without logging in. Use this instead:
>
> ```bash
> sudo apt-get install -y git gh && gh auth login   # choose GitHub.com → HTTPS → log in with a browser code
> git clone https://github.com/jack-distl/home-system.git ~/home-system
> bash ~/home-system/deploy/install.sh
> ```

The script:
- installs Node.js and Chromium
- builds the app
- sets it to start on boot
- turns off the desktop's own screen blanking
- sets the clock to Perth time
- schedules the night-time screen-off and a nightly update

When it finishes:

```bash
sudo reboot
```

The Pi restarts straight into the planner, full-screen. 🎉

From any phone or laptop on your Wi-Fi you can now open **http://planner.local:3000**. It's the same app, handy for adding to the shopping list from the couch or doing setup with a real keyboard.

## Step 4: Rotate or fix the display if needed

- **Picture fine but touches land in the wrong place** (common if the screen is rotated): open the Pi menu → *Preferences → Screen Configuration*, right-click the screen → set the **Touchscreen** to the same output and orientation.
- **The monitor's own menu** (buttons on the back or underneath):
  - set brightness to around 40–60%. It looks less like a screen and more like a print, and the panel lasts longer.
  - turn off the monitor's own power-saving/auto-standby if it switches off unexpectedly.

## Step 5: Mount it

1. Screw the mount's plate onto the monitor's **VESA 100×100** holes, after removing the stand.
2. Stick the Pi to the back of the monitor with Dual Lock, somewhere with airflow. Don't stick it to the hottest part of the monitor's back.
3. Mark the wall. The screen centre at about **150–160 cm from the floor** is comfortable for both reading and tapping.
4. Use the right fixings. Plasterboard needs proper anchors (e.g. spring toggles), or screw into a stud. Brick/concrete needs masonry plugs.
5. Hang it, route the cables, and power up.

Next: [3. Connect your calendars →](03-calendars.md)
