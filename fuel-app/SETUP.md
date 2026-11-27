# EZ Fuel Claims – setup guide

EZ Fuel works in two ways:

- **Offline (now):** each driver's bills stay on their own phone, and claims are sent as PDFs on WhatsApp.
- **Online:** every driver's bills, photos and claims go to the company's own database. **One main admin**
  sees everyone on a PC or phone, allows new people, approves claims, marks them paid and downloads reports.

## How the online version works

| Who | What they do |
|---|---|
| **Driver** | Installs the app and creates an account, then waits for the admin to allow it. After that they add a bill after every fill-up (photo, date, station, odometer, litres, KD); the app works out km, km/L and KD per litre. At 10 bills they tap **Create claim** (signature saved once). They see live whether the claim is waiting, approved, paid or returned. |
| **Admin** | **Dashboard**: people waiting to be allowed, claims to approve, approved claims to pay, every driver's progress to the next claim, last odometer, km and km/L this month. **Bills**: every bill with its photo, per driver. **Claims**: approve (amount + signature, which fills section E of the form), return with a note, reject, mark paid. **Reports**: monthly PDF per driver. **Excel** export of bills and claims. **People**: allow, turn off or turn on accounts. |

Security rules (in `firebase/firestore.rules`) make this hold even if someone tries to get around the app:
drivers see only their own data, can't add bills until allowed, can't change a bill once it's claimed,
and can't approve or mark their own claim paid. Only the admin can do those things.

---

## Step 1 – Create the Firebase project (about 10 minutes, on a computer)

1. Go to **console.firebase.google.com** and sign in with the company Google account.
2. **Create a project** named `ez-fuel`. Turn Google Analytics **off**.
3. **Build → Authentication → Get started → Email/Password →** switch on the first toggle **→ Save**.
4. **Build → Firestore Database → Create database**. Location: **me-central1 (Doha)** or **me-central2 (Dammam)**,
   which can't be changed later. Choose **production mode**.
5. In Firestore, open **Rules**, replace everything with the contents of `firebase/firestore.rules`, and click **Publish**.
6. **Gear icon → Project settings → Your apps → web icon `</>`**. Name it `EZ Fuel` and click **Register app**.
7. Copy the `const firebaseConfig = { ... }` block and **send it to Claude**. These values aren't secret
   passwords; the rules from step 5 protect the data.

Claude then connects the app and sends back the new **EZFuel.apk** and the **web** folder.

## Step 2 – Put the app online for PC and iPhone (5 minutes)

1. On a computer, open **app.netlify.com/drop** and sign up (free).
2. Drag the **web** folder onto the page. You get a link like `https://ez-fuel.netlify.app`
   (rename it under Site configuration → Change site name).
3. **PC:** open the link in Chrome or Edge. **iPhone:** Safari → Share → **Add to Home Screen**.
   **Android:** install EZFuel.apk, or use the link.

## Step 3 – Make your account the main admin (2 minutes)

1. Open the app link on your PC and tap **Create account** with your own email. It shows "Waiting for approval".
2. In the Firebase console go to **Firestore Database → Data → users**, click your document and change:
   `role` → `admin`, `active` → `true`, `pending` → `false`.
3. The app switches to the **Admin dashboard** by itself.

## Step 4 – Drivers

Drivers install the app (or open the link), tap **Create account**, and wait. Their names appear at the top of your
dashboard. Tap **Allow**, and their app opens by itself.

If a driver already used the offline version, their app offers **"Upload now"** on first sign-in, so their saved bills
and claims go online. Claims they had marked paid on the phone come in as *waiting*, with a note, so you can confirm them.

## Free plan

The free Firebase plan (1 GB storage, 50,000 reads a day) is plenty: bill photos are compressed to about
100–150 KB, so it holds roughly 6,000–8,000 bills. Usage is shown under **Usage and billing** in the console.

---

## Offline version (no server)

With `firebase: null` in `web/config.js` (the default), each phone keeps its own bills and claims, and the PDF is
sent on WhatsApp. Uninstalling the app or clearing its data deletes them.

## For developers

- `web/` is a plain HTML/JS app with no build step. `config.js` holds the Firebase settings, form number and departments.
- `web/store.js` has the offline store (`LocalStore`) and the online store (`FirebaseStore`, live Firestore listeners,
  offline persistence, one-time upload of phone data).
- `firebase/firestore.rules` was tested with the Firebase emulator, including 9 attempts to get around the rules.
- `android/build.sh` builds `EZFuel.apk` (WebView wrapper, Android 5.0+, targets Android 16).
  Keep the signing key: updates must be signed with the same key.
