# EZ Fuel Claims – install guide

Each driver installs the app on their own phone. There is no server and no account:

1. On first launch the driver enters their **name, employee ID, department and vehicle number** (once).
2. **Add bill** after every fill-up: take a photo of the bill and enter the date, station, odometer,
   litres and amount. The app works out the **km driven since the last bill**, **km per litre** and
   **price per litre**. An odometer reading lower than the previous bill is refused.
3. The home screen counts the bills: **7 / 10**. At **10 bills**, tap **Create claim**: the oldest 10 bills
   go into one claim. The driver ticks the declaration and signs **once**; the signature is saved and used
   on every later claim (change it in Profile). The claim shows the **distance driven** (odometer range),
   **average mileage** (km/L) and **average price per litre** for its 10 bills, also on the PDF.
4. Tap **Share on WhatsApp** to send the claim PDF to the office, or **Download PDF**. The PDF is form
   **EZ-OPS-FUEL-002**: sections A–D filled in, section E left blank for the office, then the bill photos.
5. **Monthly** shows the month's report (bills, km, litres, KD, km/L, claims) and shares it as a PDF,
   with or without the bill photos.
6. When the money arrives, the driver opens the claim and taps **Mark as paid**.

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
