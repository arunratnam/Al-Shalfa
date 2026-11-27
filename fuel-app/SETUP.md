# EZ Fuel Claims – install guide

Each driver installs the app on their own phone. There is no server and no account:

1. On first launch the driver enters their **name, employee ID, department and vehicle number** (once).
2. **New fuel claim**: add each fuel receipt with a photo (date, station, odometer, litres, amount in KD),
   tick the declaration and sign with a finger, then tap **Finish claim**.
3. Tap **Share on WhatsApp** to send the PDF to the office, or **Download PDF** to keep it on the phone.
   The PDF is form **EZ-OPS-FUEL-002**: sections A–D filled in, section E (verification and approval) left
   blank for the office, then the receipt photos in the same order as the table.
4. When the money arrives, the driver taps **Mark as paid**. The home screen shows what is waiting for
   payment, what was paid this month, and totals for the year.

Claims and photos are saved **on that phone only**. Uninstalling the app or clearing its data deletes them,
so drivers should keep the PDFs they send.

## Android (all phones from Android 5.0)

Send **EZFuel.apk** to the drivers (WhatsApp, email or USB) and tap it to install. Android may ask to
allow installs from WhatsApp or the browser: allow it once. If Play Protect warns about an unknown app,
tap **More details → Install anyway**.

## iPhone

iPhones can't install an APK. They use the same app as a web app:

1. Put the `web` folder online once. The easiest free way: on a computer go to **app.netlify.com/drop**,
   sign up, and drag the `web` folder onto the page. You get a link like `https://ez-fuel.netlify.app`.
2. Send the link to iPhone drivers. They open it in **Safari** → Share button → **Add to Home Screen**.
3. It then works like an app, also without internet. **Share PDF** opens the iPhone share sheet, which
   includes WhatsApp.

Nothing is stored on the website: each iPhone keeps its own claims, just like the Android app.

## For developers

- `web/` is a plain HTML/JS app with no build step. `config.js` holds the form number, departments and
  limits. With `firebase: null` (the default) the app works on the phone only.
- An online version with an office dashboard and approvals is built in (`firebase/`, `store.js` FirebaseStore).
  It switches on when a Firebase config is added to `config.js`. Its security rules were tested with the
  Firebase emulator.
- `android/build.sh` builds `EZFuel.apk` (WebView wrapper, Android 5.0+). Keep the signing key safe:
  updates must be signed with the same key.
