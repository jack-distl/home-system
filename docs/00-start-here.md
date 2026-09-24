# Start here: the whole setup, step by step

No tech experience needed. Do the steps in order and tick each one off. Every step says **what you should see**. If you don't see it, check the **"If not"** line, or copy what's on the screen and paste it to Claude.

⏱ About **2 hours** in total, plus the shopping trip. You'll need a **laptop** (Mac or Windows) on your home Wi-Fi.

---

## Part A: Shopping

- [ ] **A1.** Buy everything on the [shopping list](01-shopping-list.md). Ring the store first to check they have it in stock.
- [ ] **A2.** At home, unbox the monitor and check what cables came with it. If it came with a USB cable, you don't need to buy one.

---

## Part B: Prepare the memory card (on your laptop, ~20 min)

- [ ] **B1.** On your laptop, go to **raspberrypi.com/software**, download **Raspberry Pi Imager** and install it like any other program.
- [ ] **B2.** Put the microSD card into your laptop. It may need the little card reader.
- [ ] **B3.** Open Raspberry Pi Imager and choose the three things it asks for:
  - **Raspberry Pi Device** → *Raspberry Pi 5*
  - **Operating System** → *Raspberry Pi OS (64-bit)*, the first option, the one that mentions "desktop"
  - **Storage** → your microSD card. It's the one about the right size, e.g. "64 GB".
- [ ] **B4.** Click **Next**. When it asks *"Would you like to apply OS customisation settings?"*, click **Edit Settings** and fill in:

  | Box | What to type |
  |---|---|
  | Set hostname | `planner` |
  | Username | `family` |
  | Password | a password you'll remember. **Write it down.** |
  | Configure wireless LAN | ✔ tick. Your Wi-Fi name (SSID) and password, **exactly** as they are, capitals included |
  | Wireless LAN country | `AU` |
  | Set locale settings | ✔ tick. Time zone `Australia/Perth` |

  Then click the **Services** tab at the top → tick **Enable SSH** → choose **Use password authentication**.
  Click **Save**, then **Yes**, then **Yes** again to confirm wiping the card.

  ✅ **You should see:** a progress bar, then *"Write Successful"* after 5–15 minutes.
  ❌ **If not:** try the card again. If it fails twice, the card may be faulty; swap it at the store.

- [ ] **B5.** Take the card out of the laptop.

---

## Part C: Put it together on the kitchen bench (~15 min)

Don't mount anything on the wall yet. Get it working first.

- [ ] **C1.** Fit the cooler (or case) to the Pi, following the little leaflet in its box. It clips or sticks on.
- [ ] **C2.** Slide the microSD card into the slot on the underside of the Pi, with the label facing away from the board.
- [ ] **C3.** Take the stand off the monitor if you like, or leave it on for now. Lie it face-down on a towel to plug things in.
- [ ] **C4.** Plug in the cables:
  1. **Micro-HDMI cable**: the small end goes into the Pi's HDMI port **nearest the power socket** (marked HDMI0). The big end goes into the monitor's **HDMI** port.
  2. **USB cable**: from any of the Pi's **USB** ports (the big rectangular ones) to the monitor's USB port. This makes touch work.
  3. **Monitor power cable** into the wall.
  4. **Pi power supply** into the wall last. The Pi has no on/off switch; it turns on when it gets power.

  ✅ **You should see:** after 1–2 minutes, a desktop with a Raspberry Pi menu in a corner. Tap the menu icon and it should open.
  ❌ **If the screen says "No signal":** check the micro-HDMI is in the port nearest the power socket, and that the monitor's input is set to **HDMI** (use the buttons on the monitor).
  ❌ **If the picture is fine but touch does nothing:** check the USB cable at both ends.

---

## Part D: Install the planner (~15 min)

This is the only "techy" bit, and it's just copying and pasting.

- [ ] **D1.** Open a command window on your laptop:
  - **Mac:** press ⌘ + Space, type **Terminal**, press Enter.
  - **Windows:** click Start, type **PowerShell**, press Enter.

  You'll see a mostly blank window with a blinking cursor. That's normal.

- [ ] **D2.** Type this and press Enter:
  ```
  ssh family@planner.local
  ```
  - If it asks *"Are you sure you want to continue connecting?"*, type `yes` and press Enter.
  - Then type the password from step B4 and press Enter. **Nothing appears while you type the password.** That's normal; just type it and press Enter.

  ✅ **You should see:** a line ending in `family@planner:~ $`.
  ❌ **"Could not resolve hostname":** the Pi isn't on the Wi-Fi yet. Wait 2 more minutes and try again. If it still fails, the Wi-Fi name or password in step B4 was probably mistyped; redo Part B.
  ❌ **"Permission denied":** the password was wrong. Try again carefully.

- [ ] **D3.** Copy this whole line, paste it into the window, and press Enter. To paste, use ⌘+V on Mac, or right-click on Windows.
  ```
  curl -fsSL https://raw.githubusercontent.com/jack-distl/home-system/main/deploy/install.sh | bash
  ```
  Lots of text will scroll past for **5–15 minutes**. Leave it alone.

  ✅ **You should see:** `✅ All done!`, then *"Connection closed"* as the Pi restarts. That's expected.
  ❌ **If you see `❌ Something went wrong`:** select all the text in the window, copy it, and paste it to Claude. It can be fixed and you just run D2 and D3 again.

- [ ] **D4.** Watch the touchscreen.

  ✅ **You should see:** within about a minute, a page saying **"Let's set up your planner"** with a web address and a QR code.

---

## Part E: Connect your calendars (~20–30 min)

- [ ] **E1.** On your laptop, open a web browser (Chrome, Safari or Edge) and type the address shown on the touchscreen. It'll be **http://planner.local:3000**.
  ❌ **If it doesn't load:** try the second address shown in small print on the touchscreen (numbers like `http://192.168.1.23:3000`).

- [ ] **E2.** Follow the guide on the laptop screen. It walks you through:
  - **the iPhone calendar**, ~5 minutes. You'll make a special password on Apple's website.
  - **the Google calendar**, ~15 minutes the first time. It's lots of clicking through Google's settings pages, but every click is spelled out. Take it slowly, and don't skip the **"Publish app"** step.
  - **choosing which calendars show**, their colours and whose they are.

  ✅ **You should see:** after pressing **Finish**, the touchscreen switches to your calendar within a few seconds, showing events from both phones.

- [ ] **E3.** Test it both ways:
  - On the **touchscreen**, tap tomorrow and add an event called "Test". Within a minute it should appear in the phone's calendar app.
  - On a **phone**, add an event. Within 5 minutes it appears on the wall. Tap ⟳ at the top of the touchscreen to make it check straight away.
  - Delete both test events.

---

## Part F: Put it on the wall

- [ ] **F1.** Unplug everything. Screw the wall-mount plate onto the four screw holes on the back of the monitor. Keep the monitor's original screws and stand somewhere safe.
- [ ] **F2.** Stick the Pi onto the back of the monitor with the Dual Lock strips, where the cables reach comfortably.
- [ ] **F3.** Choose the spot. The middle of the screen at **about 150–160 cm from the floor** is comfortable for both of you to read and tap. It needs to be near a power point.
- [ ] **F4.** Fix the wall bracket, using the right plugs for your wall:
  - **Plasterboard** (sounds hollow when knocked): use plasterboard anchors, or find a stud with a stud finder.
  - **Brick/concrete:** use masonry plugs and a masonry drill bit.
  - Not comfortable drilling? Book a handyman on **Airtasker** for this step. It's a quick job.
- [ ] **F5.** Hang the screen, plug everything back in (monitor first, Pi last), and tidy the cables. A cable cover strip from Bunnings works well.

  ✅ **You should see:** the planner comes back on its own within a couple of minutes, no setup needed.

---

## Part G: Make it yours (optional)

- [ ] On each phone, open **http://planner.local:3000** in Safari/Chrome → **Share → Add to Home Screen**. Now you can add to the shopping list from the couch.
- [ ] Set the monitor's brightness to around 50% using its buttons. The art looks more like a print and less like a screen.
- [ ] ⚙ **Settings** on the touchscreen:
  - change how long before it shows art
  - change the painting theme (try "impressionism" or "sea")
  - change the night-time off hours
  - add lists like "Chores"

**You're done!** 🎉 From here it looks after itself: it restarts on its own after a power cut, and updates itself overnight.

For later: [everyday use & troubleshooting](04-using.md).
