# Al-Shalfa repository – project guide

Read this first. It describes what is in this repository and how to build and update it.

## Projects

| Folder | What it is |
|---|---|
| `fuel-app/` | **EZ Staff** (was EZ Fuel) – EZ Storage staff app: attendance, overtime, payroll, fuel bills and claims (main, in production) |
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

## Attendance, overtime and payroll (EZ Staff 2.0)

- Staff clock in and out on the Home screen by tapping their warehouse (Ardiya, Shuaiba, Mina Abdulla, Open Yard), and
  can switch warehouse during the day. GPS is saved and compared with the warehouse location set in Company settings.
- `attendance/{id}`: one entry per stay at a warehouse (`inAt`/`outAt` ms plus `inServer`/`outServer` server timestamps).
  The rules require the tap time to match the server clock (offline sync allowed up to 12 hours later, shown as "sent late").
  Supervisors and above add or correct entries for others (`source: "supervisor"`), never their own.
- OT per day = worked − normal hours (`settings.ot.standardHours`, 10 h for everyone), counted wherever the person worked;
  the whole day on the rest day (Friday) and on public holidays; rounded down to 15 minutes. Shifts only show the
  expected start. Staff may clock out at a different warehouse (`outWarehouse`, suggested from GPS).
  Stored in `ot/{uid}_{date}` as `pending`; supervisors, managers and the admin approve, change or reject it.
- Payroll (admin only): hourly wage = salary ÷ 26 ÷ 8, OT ×1.25, rest day ×1.5, holiday ×2 (editable in
  `settings/company`). Salaries live in `pay/{uid}`, readable and writable by the admin only.
  Staff, supervisors and managers never see salaries or KD for time; supervisors and managers approve OT in hours.
- Company settings (admin): warehouses with GPS location and radius, shifts (Morning 06:00–16:00, Day 08:00–18:00),
  OT rules, public holidays. Each person's shift is set on the People page.

## Fuel allowance (2.5)

- `users/{uid}.fuel`: `false` means attendance only (no bills, claims or fuel on Home). New accounts start with
  `fuel: false`; accounts without the field keep fuel. The admin ticks **Fuel allowance** per person on People.
- Rules: bills and claims create require `me().get('fuel', true) != false`; people can't change their own `fuel`.

## Versions so far

EZ Staff 2.5 (attendance, per-person fuel allowance, overtime, payroll, payslips; APK `fuel-app/android/EZFuel.apk`, label "EZ Staff", same package
`com.ezstorage.fuel` so it updates EZ Fuel 1.x), Always On Tasks 2.0 (Android), Always On Tasks 1.0 (Windows).
