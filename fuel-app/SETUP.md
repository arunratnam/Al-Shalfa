# EZ Fuel Claims – setup guide

The app works in **demo mode** straight away: data stays on that one phone, with example people and claims.
To make it the real company system (drivers submit, office approves, everyone sees live status) you connect it to a
free **Google Firebase** project that the company owns. This takes about 15 minutes on a computer.

---

## 1. Create the Firebase project (10 minutes)

1. Go to **console.firebase.google.com** and sign in with a company Google account.
2. Click **Create a project**. Name it `ez-fuel`. Turn **Google Analytics off**. Click **Create project**.
3. Left menu → **Build → Authentication** → **Get started** → choose **Email/Password** → switch on the first
   toggle (Email/Password) → **Save**.
4. Left menu → **Build → Firestore Database** → **Create database**.
   - Location: **me-central1 (Doha)** or **me-central2 (Dammam)**, the closest to Kuwait. This can't be changed later.
   - Choose **Start in production mode** → **Create**.
5. In Firestore, open the **Rules** tab. Delete everything there, paste the whole contents of
   [`firebase/firestore.rules`](firebase/firestore.rules), and click **Publish**.
6. Click the **gear icon → Project settings**. Under **Your apps**, click the **web icon `</>`**.
   Name it `EZ Fuel`, leave Hosting unticked, click **Register app**.
7. You'll see a block of code with `const firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ..., ... }`.
   **Copy that block and send it to Claude.** (These values identify your project. They are not secret passwords;
   the security rules from step 5 protect the data.)

Claude then puts it into `web/config.js` and rebuilds the Android app and the web version.

## 2. Make yourself the administrator

1. Open the connected app and **Create account** with your own work email.
2. In the Firebase console → **Firestore Database → Data** → `users` → click the document with your email →
   change **role** from `driver` to `admin` → **Update**.
3. Re-open the app. You now see **Office** and **Staff** in the menu.

From now on you give roles inside the app: **Staff** page → pick the role next to each person.

| Role | Can do |
|---|---|
| Driver | Submit and track their own fuel claims, download their PDFs |
| Verifier | Everything a driver can, plus check submitted claims: verify, return for correction, or reject |
| Approver | Approve verified claims (amount + signature), mark them paid, return or reject |
| Administrator | Everything, plus manage staff roles and turn accounts off |

## 3. Put the app online for iPhones (5 minutes)

iPhones install web apps from a link. The easiest free host:

1. On a computer, go to **app.netlify.com/drop** and sign up (free).
2. Drag the **`web`** folder (from the zip Claude sends) onto the page.
3. You get a link like `https://ez-fuel-claims.netlify.app`. In Netlify you can rename it under
   **Site configuration → Change site name**.

Share that link with staff:

- **iPhone:** open the link in **Safari** → Share button → **Add to Home Screen**.
- **Android:** install **EZFuel.apk** (Settings may ask to allow installs from your browser or WhatsApp),
  or open the link in Chrome → ⋮ → **Add to Home screen**.

(Firebase Hosting works too, if someone is comfortable with the Firebase command-line tool:
`cd firebase && firebase deploy --only hosting,firestore:rules`.)

## 4. How a claim moves

`Draft → Submitted → Verified → Approved → Paid`

- **Returned** sends it back to the driver with a note; they fix it and resubmit.
- **Rejected** closes it with a reason.
- Every step is recorded with the person's name and time, and drivers see it live.
- **Download PDF** gives the claim in the layout of form EZ-OPS-FUEL-002, with signatures and the receipt photos.
- **Office → All claims → Export Excel (CSV)** gives a spreadsheet of the filtered claims for accounts.

## 5. Free plan limits

The free Firebase plan includes 1 GB of storage and 50,000 reads a day. Receipt photos are compressed to about
100–150 KB, so that's roughly **6,000–8,000 receipts** before you'd need the paid plan (pay as you go, usually a
few dollars a month at this size). Firebase shows usage under **Usage and billing**.

## For developers

- `web/` is a plain HTML/JS app, with no build step. `config.js` holds the settings.
- `firebase/firestore.rules` holds the security rules. They were tested with the Firebase emulator: drivers can't
  approve, edit submitted claims, read other people's data or change their own role.
- `android/build.sh` builds `EZFuel.apk` (WebView wrapper, Android 5.0+). Keep the signing key safe:
  updates must be signed with the same key.
