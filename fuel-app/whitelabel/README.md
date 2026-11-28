# Selling the staff app to another company (white label)

Each customer gets **their own copy**: their name, logo, colour, warehouses and their **own Firebase database**
(their data never mixes with EZ Storage or anyone else). The code is the same for everyone, so a fix or a new
feature reaches every customer by rebuilding.

## What you need from the customer

| Item | Example |
|---|---|
| Company name and app name | Al Noor Logistics, "Al Noor Staff" |
| Logo (PNG, wide) and optional square icon | `logo.png`, `icon.png` (512 × 512) |
| Brand colour | `#0f6e5c` |
| Warehouses / sites | Sulaibiya, Jahra Yard |
| Shifts, normal hours per day, weekly rest day | 07:00–16:00, 8 h, Friday |
| Fuel claim form number (if they use fuel claims) | ANL-OPS-FUEL-001 |
| Admin's email | the person who allows staff and runs payroll |

## Steps (about 1 hour per customer)

1. **Firebase project in the customer's Google account** (they own their data and pay their own small bill):
   console.firebase.google.com → Create project → Authentication: Email/Password on → Firestore: create
   (production mode, region me-central1/2) → Project settings → Your apps → Web app → copy the config.
2. **Customer folder:** copy `customers/_template` to `customers/<short-id>` (e.g. `customers/alnoor`), put in
   `logo.png` (and `icon.png`), and fill in `customer.json` (names, `appId` like `com.alnoorlogistics.staff`,
   colour, the Firebase config, warehouses, shifts, overtime).
3. **Build:**
   ```
   python3 whitelabel/make.py whitelabel/customers/alnoor
   ANDROID_ALL=<android-all.jar> KEYSTORE=<alnoor signing key> KS_PASS=<its password> \
     python3 whitelabel/make.py whitelabel/customers/alnoor --apk
   ```
   Output in `whitelabel/dist/alnoor/`: `web/`, the Android `.apk`, Firebase files and `SETUP.txt`.
4. **Publish** (from `whitelabel/dist/alnoor/`, signed in with `firebase login` to the customer's account):
   `firebase deploy` → rules + website at `https://<project-id>.web.app` (works on PC and iPhone).
5. **Admin account:** the customer's admin creates an account on the website; in Firestore → users → their
   document set `role` = `admin`, `active` = `true`, `pending` = `false`.
6. **Admin setup in the app:** Company settings → stand at each warehouse and tap *Use my location here*;
   check shifts, overtime rules, public holidays; People → allow staff, roles, Fuel allowance, Live location.
7. **Google Maps (optional):** a Maps key in the customer's own Google Cloud project, restricted to
   `<project-id>.web.app/*` and `appassets.androidplatform.net/*` → Company settings → Google Maps key.

## Keep safe for every customer

- **Their signing key** (`KEYSTORE`) and password: every update must be signed with the same key, or phones must
  uninstall the app and sign in again.
- **Their `versionCode`**: raise it in `customer.json` for each new Android build.
- `customers/<id>/customer.json` holds their settings. `dist/` is not saved to git (rebuild any time).

## Before selling

- Agree with EZ Storage who owns the app, and keep this repository **private**.
- Give each customer: a short privacy policy (location and photos are recorded), terms of use, and
  confirmation from their HR/accountant that the overtime and payroll rules match their contracts.
