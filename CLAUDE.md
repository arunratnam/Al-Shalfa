# Al-Shalfa repository – project guide

Read this first. It describes what is in this repository and how to build and update it.

## Projects

| Folder | What it is |
|---|---|
| `fuel-app/` | **EZ Fuel** – fuel expense claims for EZ Storage staff (main, in production) |
| `android-app/` | **Always On Tasks** – Android floating checklist app |
| `windows-app/` | Always On Tasks for Windows (C# WinForms, built with Mono) |
| `aod.html` | Always-on-display web page |
| `index.html` | the original Al Shalfa website |

## EZ Fuel (`fuel-app/`)

**What it does:** drivers and staff add each fuel bill (photo, date, station, odometer, litres, KD). The app works out
km since the previous bill, km/L and KD per litre. Every **10 bills** they create a claim (signature saved once), and
the PDF follows form **EZ-OPS-FUEL-002**. There's also a monthly report PDF and WhatsApp sharing.

**Online (production):** Firebase project **`ezfuel-20933`** (Auth email/password plus Firestore; photos are stored
in Firestore, on the Spark/free plan). Config is in `fuel-app/web/config.js`. With `firebase: null` the app runs
offline on each phone.

**Roles** (`users/{uid}.role`): `driver` (staff) → `supervisor` (verifies) → `manager` (approves, marks paid) →
`admin` (also allows new accounts and sets roles on the People page). New accounts start `active: false, pending: true`
until the admin taps **Allow**. Nobody can verify or approve their own claim.
Claim status: `submitted → verified → approved → paid`, or `returned` / `rejected`.

**Security rules:** `fuel-app/firebase/firestore.rules`. They must be pasted into Firebase console → Firestore → Rules →
Publish whenever they change. They were tested with the Firebase emulator (`firebase emulators:start --only auth,firestore`,
project `demo-ezfuel`, `useEmulators: true` in a copy of config.js).

**Where it runs**
- iPhone and PC: GitHub Pages from branch `claude/always-on-display-task-ha76x0` at
  https://arunratnam.github.io/Al-Shalfa/fuel-app/web/ (`.nojekyll` at the root). Pushing to that branch updates it.
- Android: `fuel-app/android/EZFuel.apk` (WebView wrapper serving `web/` from assets at
  `https://appassets.androidplatform.net/web/`). minSdk 21, targetSdk 36.

**Code**
- `fuel-app/web/` – plain HTML/JS with no build step: `app.js` (screens), `store.js` (`LocalStore` offline and
  `FirebaseStore` online), `pdf.js` (claim and monthly PDFs with jsPDF), `config.js`, `vendor/` (jsPDF, Firebase compat SDK).
- `fuel-app/android/` – `build.sh` (aapt + javac + dalvik-exchange + apksigner, no Gradle); `framework/gen.py` makes
  the Android attribute table from the Android 15 framework jar (`org.robolectric:android-all:15-robolectric-12650502`).
- Build: `ANDROID_ALL=<android-all.jar> KEYSTORE=<EZFuel-signing-key.keystore> ./build.sh`.
  Needs `apt-get install aapt apksigner zipalign dalvik-exchange`. Bump `versionCode` in `AndroidManifest.xml` for each release.

**Signing keys** are NOT in the repository (the repository is public). The owner keeps
`EZFuel-signing-key.keystore` (alias `app`) and `AlwaysOnTasks-signing-key.keystore` (alias `app`) privately.
Ask for them before building an Android update; without the same key, phones must uninstall first and lose saved data.

**Testing:** Playwright (Chromium) end-to-end scripts drove the claim flow, roles and security checks. Serve
`fuel-app/web` with `python3 -m http.server` and test at phone size (Pixel 7) and desktop size.

## Versions so far

EZ Fuel 1.8 (roles), Always On Tasks 2.0 (Android), Always On Tasks 1.0 (Windows).
