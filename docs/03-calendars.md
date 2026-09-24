# 3. Connect your calendars

The planner syncs **both ways**:
- Anything you add, change or delete on the wall screen goes straight to the real calendar, so it shows up on your phones within seconds.
- Anything you add on your phones appears on the screen within 5 minutes. Tap ⟳ to pull it now.

Each of you connects your own account once. Afterwards, open **Settings → Calendars on the screen** to:
- choose which calendars show
- set a colour for each one
- type whose it is ("Jack", "Wife's name", "Family")

The name shows as a small label on each event, and the colour is how you tell people apart at a glance.

> **Tip: make a shared "Family" calendar.** Create it in iCloud (Calendar app → Add Calendar → share with each other) or in Google. Put joint things there. Each person's work or personal calendar stays separate but can still show on the wall.

Do this from a laptop or phone at **http://planner.local:3000 → ⚙ Settings**. It's much easier with a real keyboard.

---

## iPhone / iCloud calendars (5 min per person)

Apple needs a special **app-specific password**, which lets the planner use only your calendar. Your real Apple ID password is never given to it.

1. On any browser go to **<https://account.apple.com>** and sign in.
2. **Sign-In and Security → App-Specific Passwords → +**. Name it "Home planner".
3. Apple shows a password like `abcd-efgh-ijkl-mnop`. Copy it.
4. In the planner: **Settings → Add an iPhone (iCloud) calendar**.
   - **Whose is it?** your name
   - **Apple ID email**
   - **App-specific password**: paste it
   - leave **Server** blank
5. Tap **Connect**. Your iCloud calendars appear within a few seconds.

You can revoke access at any time from the same Apple page.

---

## Google calendars (one-off 15 min setup, then 1 min per person)

Google makes every app register first. It's free and you only do it once.

### Part 1: Register the planner with Google (once)

1. Go to **<https://console.cloud.google.com>** and sign in with either Google account.
2. Top bar → project picker → **New project** → name it `Home planner` → Create. Make sure it's selected.
3. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
4. **APIs & Services → OAuth consent screen** (may be called "Google Auth Platform"):
   - **App name:** Home planner. **User support email:** yours. **Audience: External.**
   - **Data access / Scopes:** add `https://www.googleapis.com/auth/calendar`
   - **Audience → Publish app → In production.**
     > ⚠ This matters. If you leave it in "Testing", Google disconnects the planner **every 7 days**. Publishing doesn't make anything public; it just stops the expiry. Google won't "verify" a personal app, and that's fine.
5. **Clients (Credentials) → Create client → OAuth client ID**:
   - **Application type:** Web application
   - **Authorised redirect URIs:** `http://localhost:3000/api/oauth/google/callback`
   - Create, then copy the **Client ID** and **Client secret**.
6. Put them on the Pi:
   ```bash
   ssh family@planner.local
   nano ~/home-system/.env
   ```
   Fill in `GOOGLE_CLIENT_ID=` and `GOOGLE_CLIENT_SECRET=`, save (Ctrl+O, Enter, Ctrl+X), then:
   ```bash
   sudo systemctl restart home-planner
   ```

### Part 2: Connect each Google account

1. **Settings → Add a Google calendar → 1. Get sign-in link → 2. Open this link.**
2. Choose your Google account. You'll see **"Google hasn't verified this app"**: tap **Advanced → Go to Home planner (unsafe)**. It's your own app, so this is expected.
3. Allow calendar access.
4. What happens next depends on where you're doing it:
   - **On the wall screen itself:** you're sent straight back and it's done.
   - **On a laptop or phone:** the last page says *"This site can't be reached"* with an address starting `http://localhost:3000/…`. That's expected. **Copy that whole address**, paste it into box 3 in Settings, and tap **Finish**.

---

## Other calendars

- **Outlook/Exchange:** not supported yet (see the [roadmap](roadmap.md)).
- **Fastmail, Nextcloud and other CalDAV services:** use the iCloud option and enter the provider's CalDAV server address in **Server**.

## How editing works

- **Moving an event to someone else's calendar:** choose a different calendar chip in the editor. The planner creates it there and removes it from the original.
- **Repeating events** (e.g. weekly swimming): editing or deleting from the wall changes **that one day only**. Change the whole series from your phone.
- **Read-only calendars** (public holidays, shared calendars you can't edit): these show on the screen, but the editor won't let you change them.
- **Changed in two places at once:** the planner refreshes and asks you to try again, so neither change is silently overwritten.

Next: [4. Everyday use & looking after it →](04-using.md)
